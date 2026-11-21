#!/usr/bin/env -S uv run --quiet --script
# /// script
# requires-python = ">=3.11"
# dependencies = ["curl_cffi>=0.7", "playwright>=1.48", "numpy>=1.26"]
# ///
"""dj-fetch: get DJ-ready tracks from a track list.

For each track: look up the release on Beatport to learn the target version and
length of its extended version (however it is labeled), skip it if it's
already in a library folder, take SoundCloud-native tracks from the uploader's
free download, and otherwise search Soulseek through slskd, rank every file it
returns, and download from the best peers until a copy of the right length
arrives. State lives in <library_root>/<list>/_state/state.sqlite, so a run can
be stopped and resumed.
"""
import argparse, collections, csv, tempfile, hashlib, json, os, re, shutil, sqlite3, subprocess, sys, threading, time, tomllib, unicodedata, urllib.error, urllib.parse, urllib.request, uuid
from pathlib import Path

SKILL_DIR = Path(__file__).resolve().parent.parent
PREFS = tomllib.loads((SKILL_DIR / "preferences.toml").read_text())
CONFIG_PATH = Path(os.environ.get("DJ_FETCH_CONFIG", "~/.config/dj-fetch/config.toml")).expanduser()
PACE_DB = Path("~/.local/share/dj-fetch/pace.sqlite").expanduser()
AUDIO_EXTS = {"mp3", "m4a", "aac", "flac", "wav", "aiff", "aif", "alac", "ogg", "opus"}
TERMINAL = ("done", "have", "review", "missing", "gate", "skipped")
ACTIVE = ("pending", "sc", "sc_active", "gating", "gating_active", "search", "searching", "transfer")

STOP = {"the", "a", "an", "and", "of", "feat", "ft", "featuring", "with", "vs", "x"}
VERSION_WORDS = re.compile(r"\b(remix|bootleg|mashup|edit|flip|vip|remake|rework|refix|dub|mix|version|rerub|redrum|cover|extended|acapella|acappella|instrumental)\b", re.I)
VERSION_SET = {"extended", "remix", "bootleg", "mashup", "edit", "flip", "vip", "remake", "rework", "refix", "dub", "mix", "version", "rerub", "redrum", "cover"}
GENERIC_MIX = {"extended", "original", "mix", "club", "main", "version", "full", "length", "radio", "edit", "remix", "vocal"}
TRAILING_FEAT = re.compile(r"\s+(?:feat\.?|ft\.?|featuring)\s+.*$", re.I)
FEAT = re.compile(r"\s*[\(\[]\s*(?:feat\.?|ft\.?|featuring|with)\s+[^\)\]]*[\)\]]", re.I)
ARTIST_SPLIT = re.compile(r"\s*(?:,|&|\bx\b|\bvs\.?|\bfeat\.?|\bft\.?|\bfeaturing\b|\band\b|\bwith\b)\s*", re.I)


# ---------------------------------------------------------------- text

def norm(s):
    s = unicodedata.normalize("NFKD", s or "").encode("ascii", "ignore").decode().lower()
    s = s.replace("'", "").replace("’", "")
    s = re.sub(r"(?<![a-z])(?:[a-z]\.){2,}", lambda m: m.group().replace(".", ""), s)
    return re.sub(r"[^a-z0-9]+", " ", s).strip()


def tokens(s):
    s = re.sub(r"\S*\*\S*", " ", s or "")  # censored words ("F*re") can't be matched
    return [t for t in norm(s).split() if t not in STOP and (len(t) > 1 or t.isdigit())]


def title_tokens(s):
    """Every real word of a title. Unlike tokens(), filler words stay: "WITH ME" must not shrink to "me"."""
    s = re.sub(r"\S*\*\S*", " ", s or "")
    return [t for t in norm(s).split() if t not in ("feat", "ft", "featuring") and (len(t) > 1 or t.isdigit())]


def tokset(s):
    return set(norm(s).split())


def has_phrase(normed, phrase):
    return re.search(r"(?<![a-z0-9])" + re.escape(norm(phrase)) + r"(?![a-z0-9])", normed) is not None


class Request:
    """A requested track, split into the parts matching needs."""

    def __init__(self, artist, title):
        self.artist, self.title = artist.strip(), title.strip()
        t = FEAT.sub(" ", self.title)
        labels, core = [], t
        for m in re.finditer(r"[\(\[]([^\(\)\[\]]*)[\)\]]", t):
            if VERSION_WORDS.search(m.group(1)):
                labels.append(m.group(1))
                core = core.replace(m.group(0), " ")
            else:
                core = core.replace(m.group(0), " " + m.group(1) + " ")
        dash = re.match(r"(.*?)\s+-\s+(.*\b(?:remix|mix|edit|bootleg|flip|vip|rework|version)\b.*)$", core, re.I)
        if dash:
            core, labels = dash.group(1), labels + [dash.group(2)]
        self.label = " ".join(labels)
        self.core = " ".join(core.split())
        self.core_tokens = title_tokens(self.core)
        label_norm = norm(self.label)
        self.kind = next((w for w in ("mashup", "bootleg", "flip", "rework", "remake", "refix", "vip", "dub", "edit", "remix") if has_phrase(label_norm, w)), "")
        self.remixer_tokens = [t for t in tokens(self.label) if t not in GENERIC_MIX and t not in VERSION_SET]
        self.label_words = set(label_norm.split())
        self.artists = [a for a in ARTIST_SPLIT.split(self.artist) if tokens(a)]
        self.primary = self.artists[0] if self.artists else self.artist

    @property
    def wants_named_version(self):
        # "Say My Name - Remix" (Spotify's form, remixer listed as artist) asks for a remix too.
        return bool(self.remixer_tokens) or self.kind == "remix" or self.kind in ("mashup", "bootleg", "flip", "rework", "remake", "refix", "vip", "dub")

    def queries(self):
        a, c, r = " ".join(tokens(self.primary)), " ".join(self.core_tokens), " ".join(self.remixer_tokens)
        distinctive = len(self.core_tokens) >= 2 and len(c) >= 8
        out = [f"{a} {c} {r}"]
        if r:
            out.append(f"{c} {r}")
        elif distinctive:
            out.append(c)
        for other in self.artists[1:3]:
            out.append(f"{' '.join(tokens(other))} {c} {r}")
        if r and distinctive:
            out.append(c)
        seen, res = set(), []
        for qy in out:
            qy = " ".join(qy.split())
            if qy and qy not in seen:
                seen.add(qy)
                res.append(qy)
        return res


def track_id(artist, title):
    return hashlib.sha1(f"{norm(artist)}|{norm(title)}".encode()).hexdigest()[:12]


def safe_name(s):
    return re.sub(r"[/:\\\0]", "-", s).strip().rstrip(".")[:180]


# ---------------------------------------------------------------- config

def load_config():
    if not CONFIG_PATH.exists():
        sys.exit(f"Missing {CONFIG_PATH}. Run scripts/setup_slskd.py first.")
    cfg = tomllib.loads(CONFIG_PATH.read_text())
    cfg["library_root"] = Path(cfg["library_root"]).expanduser()
    cfg["have_dirs"] = [Path(p).expanduser() for p in cfg.get("have_dirs", [])]
    return cfg


# ---------------------------------------------------------------- matching

def file_basename(path):
    return re.split(r"[\\/]", path)[-1]


def file_title_extra(req, stem):
    """Title words in a filename beyond the requested title and the artists' names. A one-word title like
    "Body" can hide inside another song's title ("Life Is Simple (Move Your Body)"); many extra words means
    a different song. Returns None when the requested title isn't in the filename's title at all."""
    stem = re.sub(r"^\s*\d{1,3}[\s._-]+", "", stem.replace("_", " "))
    if " - " in stem:
        title = stem.rsplit(" - ", 1)[-1]
    else:  # artist-title joined by a bare hyphen: "08-franky wah and gadjo-im watching you"
        title = re.split(r"-(?![^\(\[]*[\)\]])", stem)[-1]
    words = {t for t in Request("x", title).core_tokens if not t.isdigit()}
    if not set(req.core_tokens) <= words:
        return None
    names = set()
    for a in req.artists + [req.artist]:
        names |= set(norm(a).split())
    return words - set(req.core_tokens) - set(req.remixer_tokens) - names - GENERIC_MIX - STOP - {"kbps", "www", "com", "org", "mst", "original", "extended"}


def evaluate(req, f, target_len, peer=None):
    """Judge one Soulseek file for a request. Returns (ok, score, notes)."""
    prefs_f, prefs_v = PREFS["formats"], PREFS["versions"]
    path = f.get("filename", "")
    base = file_basename(path)
    stem, _, ext = base.rpartition(".")
    ext = (f.get("extension") or ext).lower().lstrip(".")
    notes, score = [], 0.0
    if ext not in prefs_f["order"]:
        return False, 0, [f"format {ext or '?'} not accepted"]
    lossless = ext in prefs_f["lossless"]
    br = f.get("bitRate")
    if not br and f.get("size") and f.get("length"):
        br = int(f["size"] * 8 / f["length"] / 1000)  # peers often omit bitrate; size/length is close enough
    if not lossless:
        if br and br < prefs_f["min_lossy_kbps"]:
            return False, 0, [f"{br} kbps"]
        if not br and "320" not in path:
            return False, 0, ["lossy with unknown bitrate"]
    full_norm, name_norm = norm(path), norm(stem)
    for m in prefs_v["rip_markers"]:
        if has_phrase(full_norm, m):
            return False, 0, [f"looks like a rip ({m})"]
    full_set, name_set = set(full_norm.split()), set(name_norm.split())
    if not all(t in full_set for t in tokens(req.primary)):
        return False, 0, ["first-listed artist not in path"]
    if not all(t in name_set for t in req.core_tokens):
        return False, 0, ["title not in filename"]
    if req.remixer_tokens and not all(t in name_set for t in req.remixer_tokens):
        return False, 0, ["requested version not in filename"]
    if req.kind and not has_phrase(name_norm, req.kind):
        return False, 0, [f"requested {req.kind} not in filename"]
    extra = file_title_extra(req, stem)
    if extra is not None and len(extra) > 2:
        return False, 0, [f"different song (title has {' '.join(sorted(extra))})"]
    extra = name_set - set(req.core_tokens) - set(req.remixer_tokens) - set(norm(req.artist).split())
    for m in prefs_v["unrequested_markers"]:
        if has_phrase(name_norm, m) and not has_phrase(norm(req.label), m) and not has_phrase(norm(req.core), m):
            if m == "edit" and has_phrase(name_norm, "extended edit"):
                continue
            return False, 0, [f"different version ({m})"]
    if not req.wants_named_version and re.search(r"[\(\[][^\)\]]*\b(?:remix|bootleg|edit|flip|mashup)\b", stem, re.I):
        return False, 0, ["different version (named remix/edit)"]
    length = f.get("length")
    if target_len:
        if length:
            d = abs(length - target_len)
            if d <= prefs_v["length_tolerance_seconds"]:
                score += 1000
            elif d <= prefs_v["review_tolerance_seconds"]:
                score += 200
                notes.append(f"length off by {d:.0f}s")
            else:
                return False, 0, [f"length {length}s vs target {target_len:.0f}s"]
        else:
            notes.append("length unknown; checked after download")
    else:
        if length and length < 120:
            return False, 0, [f"too short ({length}s)"]
        # No Beatport length to check against: the longest copy is most likely the extended one.
        if length:
            score += min(length, 600) / 6
        if "extended" in name_set:
            score += 100
    order = prefs_f["order"]
    score += (len(order) - order.index(ext)) * 25
    if br and not lossless:
        score += min(br, 320) / 32
    if peer:
        if peer.get("hasFreeUploadSlot"):
            score += 60
        score -= min(peer.get("queueLength") or 0, 50) * 2
        score += min((peer.get("uploadSpeed") or 0) / 1_000_000 * 5, 30)
    if extra - GENERIC_MIX - {"mp3", "wav", "flac", "aiff", "320", "kbps", "www"} and len(extra) > 6:
        notes.append("extra words in filename")
        score -= 10
    return True, score, notes


# ---------------------------------------------------------------- beatport

_bp_lock = threading.Lock()
_bp_last = [0.0]


def beatport_search(text):
    from curl_cffi import requests
    with _bp_lock:
        wait = PREFS["beatport"]["request_interval_seconds"] - (time.time() - _bp_last[0])
        if wait > 0:
            time.sleep(wait)
        _bp_last[0] = time.time()
    for attempt in range(3):
        try:
            r = requests.get("https://www.beatport.com/search/tracks", params={"q": text, "per_page": 50}, impersonate="chrome", timeout=30)
            if r.status_code == 200:
                break
        except Exception:
            pass
        time.sleep(3 * (attempt + 1))
    else:
        raise RuntimeError(f"Beatport search failed for {text!r}")
    m = re.search(r'<script id="__NEXT_DATA__" type="application/json">(.*?)</script>', r.text, re.S)
    if not m:
        return []
    hits, seen = [], set()

    def walk(o):
        if isinstance(o, dict):
            if "mix_name" in o and ("length" in o or "length_ms" in o) and ("track_name" in o or "name" in o):
                tid = o.get("track_id") or o.get("id")
                if tid not in seen:
                    seen.add(tid)
                    hits.append(o)
            for v in o.values():
                walk(v)
        elif isinstance(o, list):
            for v in o:
                walk(v)

    walk(json.loads(m.group(1)))
    return hits


def beatport_track(url):
    """The track behind a Beatport track URL, in the same shape as a search hit."""
    from curl_cffi import requests
    with _bp_lock:
        wait = PREFS["beatport"]["request_interval_seconds"] - (time.time() - _bp_last[0])
        if wait > 0:
            time.sleep(wait)
        _bp_last[0] = time.time()
    r = requests.get(url, impersonate="chrome", timeout=30)
    m = re.search(r'<script id="__NEXT_DATA__" type="application/json">(.*?)</script>', r.text, re.S) if r.status_code == 200 else None
    if not m:
        return None
    t = (json.loads(m.group(1)).get("props", {}).get("pageProps", {}) or {}).get("track")
    if not t or not t.get("track_length_ms"):
        return None
    artists = [{"artist_name": a.get("name", ""), "artist_type_name": "Artist"} for a in t.get("artists") or []]
    artists += [{"artist_name": a.get("name", ""), "artist_type_name": "Remixer"} for a in t.get("remixers") or []]
    return {"track_id": t.get("track_id"), "track_name": t.get("track_name", ""), "mix_name": t.get("mix_name", ""),
            "length": t["track_length_ms"], "bpm": t.get("bpm"), "key_name": t.get("key"), "artists": artists,
            "sample_url": t.get("sample_url"), "sample_start_ms": t.get("sample_start_ms")}


def bp_length(h):
    v = h.get("length_ms") or h.get("length")
    if isinstance(v, str) and ":" in v:
        mm, ss = v.split(":")[-2:]
        return int(mm) * 60 + int(ss)
    if isinstance(v, (int, float)):
        return v / 1000 if v > 10000 else v
    return None


def is_short_version(mix, req):
    """Radio edits and other cut-downs. Whatever else Beatport calls a version, the label doesn't matter."""
    m = norm(mix)
    return bool(re.search(r"\b(radio|short)\b", m)) or (m.endswith("edit") and req.kind != "edit")


def beatport_match(req, hits):
    out = []
    for h in hits:
        name = h.get("track_name") or h.get("name") or ""
        mix = h.get("mix_name") or ""
        names = " ".join(a.get("artist_name", "") for a in h.get("artists") or [])
        # Parse Beatport's name the way requests are parsed, then require the same title words:
        # "Show Me" must never stand in for "WITH ME".
        hc, rc = set(Request("x", TRAILING_FEAT.sub("", FEAT.sub(" ", name))).core_tokens), set(req.core_tokens)
        if not rc or hc != rc:
            continue
        if not set(tokens(req.primary)) <= set(norm(names).split()):
            continue  # the first-listed artist must be on the release, not just a featured one
        version_text = norm(f"{name} {mix} " + " ".join(a.get("artist_name", "") for a in h.get("artists") or [] if a.get("artist_type_name") == "Remixer"))
        if req.kind and not has_phrase(version_text, req.kind):
            continue  # a VIP / bootleg / edit request can't be answered by some other version
        if req.remixer_tokens:
            if not all(t in version_text.split() for t in req.remixer_tokens):
                continue
        else:
            extra = set(tokens(mix)) - GENERIC_MIX
            if extra or re.search(r"[\(\[][^\)\]]*\b(remix|edit|bootleg|flip|vip)\b", name, re.I):
                continue
            if "remix" in norm(mix).split() and not req.kind:
                continue
        length = bp_length(h)
        if not length:
            continue
        out.append({"track_id": h.get("track_id") or h.get("id"), "name": name, "mix_name": mix, "length": length,
                    "sample_url": h.get("sample_url"), "sample_start_ms": h.get("sample_start_ms"),
                    "bpm": h.get("bpm"), "key": h.get("key_name"), "artists": names,
                    "short": is_short_version(mix, req), "release_date": h.get("release_date")})
    if not out:
        return None
    # The extended version is the full-length one, labeled Extended, Original or nothing.
    out.sort(key=lambda x: (x["short"], -x["length"]))
    best = out[0]
    best["url"] = f"https://www.beatport.com/track/{re.sub(r'[^a-z0-9]+', '-', norm(best['name']))}/{best['track_id']}"
    best["other_versions"] = sorted({(o["mix_name"], round(o["length"])) for o in out[1:]})
    return best


def resolve_beatport(req, row=None):
    """Find the version to target. Links in the input row are used first, then Beatport search."""
    linked = []
    for url in re.split(r"\s*\|\s*", (row or {}).get("beatport") or "")[:3]:
        if re.match(r"https?://(?:www\.)?beatport\.com/track/", url):
            try:
                hit = beatport_track(url)
            except Exception:
                hit = None
            if hit:
                linked.append(hit)
    queries = [" ".join([*tokens(req.primary), *req.core_tokens, *req.remixer_tokens])]
    if req.remixer_tokens:
        queries.append(" ".join([*req.core_tokens, *req.remixer_tokens]))
    queries.append(" ".join([*tokens(req.primary), *req.core_tokens]))
    best = None
    for qy in dict.fromkeys(queries):
        best = beatport_match(req, linked + beatport_search(qy))
        if best:
            break
    best = best or beatport_match(req, linked)
    if best and not best.get("sample_url"):
        try:
            page = beatport_track(best["url"])
            if page and page.get("track_id") == best["track_id"]:
                best["sample_url"], best["sample_start_ms"] = page.get("sample_url"), page.get("sample_start_ms")
        except Exception:
            pass
    return best


# ---------------------------------------------------------------- audio

def probe(path):
    r = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration,bit_rate:stream=codec_type,codec_name,sample_rate",
                        "-of", "json", str(path)], capture_output=True, text=True)
    if r.returncode:
        return None
    info = json.loads(r.stdout)
    audio = [s for s in info.get("streams", []) if s.get("codec_type") == "audio"]
    dur = float(info.get("format", {}).get("duration") or 0)
    if not audio or dur <= 0:
        return None
    return {"duration": dur, "codec": audio[0].get("codec_name"), "bit_rate": int(info["format"].get("bit_rate") or 0)}


# ---------------------------------------------------------------- audio identity

PREVIEW_CACHE = Path("~/.cache/dj-fetch/previews").expanduser()


def fingerprint(path):
    """Chromaprint raw fingerprint (list of 32-bit ints, about 8 per second) of the whole file."""
    r = subprocess.run(["fpcalc", "-raw", "-json", "-length", "1500", str(path)], capture_output=True, text=True)
    if r.returncode:
        return None
    return json.loads(r.stdout).get("fingerprint") or None


def fp_similarity(a, b):
    """Best bit agreement (0..1) of the shorter fingerprint slid along the longer one. Same recording scores
    about 0.9 or more; different songs about 0.5-0.6."""
    import numpy as np
    if not a or not b or min(len(a), len(b)) < 60:
        return None
    a, b = np.asarray(a, dtype=np.uint32), np.asarray(b, dtype=np.uint32)
    if len(a) > len(b):
        a, b = b, a
    pop = np.array([bin(i).count("1") for i in range(256)], dtype=np.uint8)
    n = len(a)
    return max(1 - pop[np.bitwise_xor(a, b[o:o + n]).view(np.uint8)].sum() / (32.0 * n) for o in range(len(b) - n + 1))


def beatport_preview_match(target, path):
    """Compare a downloaded file with the Beatport preview of its target. Returns similarity or None."""
    url = (target or {}).get("sample_url")
    if not url or not shutil.which("fpcalc"):
        return None
    from curl_cffi import requests
    PREVIEW_CACHE.mkdir(parents=True, exist_ok=True)
    prev = PREVIEW_CACHE / f"{target['track_id']}.mp3"
    if not prev.exists():
        r = requests.get(url, impersonate="chrome", timeout=60)
        if r.status_code != 200 or len(r.content) < 50_000:
            return None
        prev.write_bytes(r.content)
    # The whole file: a longer or shorter version puts the previewed part somewhere else, so a window
    # around Beatport's preview offset would compare the wrong stretch (that flagged right songs as wrong).
    return fp_similarity(fingerprint(prev), fingerprint(path))


# Words in a store title that still describe the plain release.
PLAIN_WORDS = {"extended", "original", "mix", "radio", "edit", "club", "version", "feat", "ft", "featuring", "with"}


def store_previews(req):
    """30-second Deezer and iTunes previews whose title is the requested song: [(label, path, same_version)]."""
    from curl_cffi import requests
    PREVIEW_CACHE.mkdir(parents=True, exist_ok=True)
    q = " ".join([*tokens(req.primary), *req.core_tokens, *req.remixer_tokens])
    found = []
    try:
        for x in requests.get("https://api.deezer.com/search", params={"q": q}, timeout=30).json().get("data", [])[:6]:
            found.append((f"Deezer {x['artist']['name']} - {x['title']}", x.get("preview"), f"dz{x['id']}", x["artist"]["name"], x["title"]))
    except Exception:
        pass
    try:
        res = requests.get("https://itunes.apple.com/search", params={"term": q, "entity": "song", "limit": 8}, timeout=30).json()
        for x in res.get("results", [])[:8]:
            found.append((f"iTunes {x['artistName']} - {x['trackName']}", x.get("previewUrl"), f"it{x['trackId']}", x["artistName"], x["trackName"]))
    except Exception:
        pass
    out = []
    for label, url, key, artist, title in found:
        if not url or not set(req.core_tokens) <= set(title_tokens(title)):
            continue
        words = set(tokens(artist + " " + title))
        # Same version: the requested artist and remixer are named, and the title adds nothing else
        # (a year, another remixer, "Midnight Remix") beyond the requested title, its artists and plain-mix words.
        extra = set(title_tokens(title)) - set(title_tokens(req.title)) - set(tokens(req.artist)) - set(tokens(artist)) - PLAIN_WORDS
        # A requested VIP, bootleg or edit must be named: the plain release is another version.
        named = not req.kind or (req.kind == "remix" and req.remixer_tokens) or has_phrase(norm(title), req.kind)
        same = set(tokens(req.primary)) <= words and set(req.remixer_tokens) <= words and not extra and named
        p = PREVIEW_CACHE / f"{key}.mp3"
        if not p.exists():
            try:
                r = requests.get(url, impersonate="chrome", timeout=60)
            except Exception:
                continue
            if r.status_code != 200 or len(r.content) < 20_000:
                continue
            p.write_bytes(r.content)
        out.append((label, p, same))
    return out


def store_preview_check(req, path, min_sim):
    """Identity check for tracks without a Beatport preview. Returns (similarity or None, reason to reject or None).

    A preview of the same version must match. A file that matches a different version (another artist's remake,
    a remix) much better, when nothing of the requested version matches, is the wrong song."""
    me = fingerprint(path)
    own, other = [], []
    for label, p, same in store_previews(req):
        s = fp_similarity(fingerprint(p), me)
        if s is not None:
            (own if same else other).append((s, label))
    best_own = max(own, default=None)
    best_other = max(other, default=None)
    if best_own and best_own[0] >= min_sim:
        return best_own[0], None
    if best_other and best_other[0] >= 0.85:
        return best_other[0], f"sounds like {best_other[1]} ({best_other[0]:.2f}), not the requested version"
    if best_own:
        return best_own[0], f"audio doesn't match {best_own[1]} ({best_own[0]:.2f})"
    return None, None


def player_ready(src):
    """Convert to AIFF a file Aaron's player can't load (ALAC, or lossless above its sample rate limit).
    Returns the path of a playable file next to src (src itself when nothing needed doing)."""
    pl = PREFS.get("player", {})
    r = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "a:0", "-show_entries",
                        "stream=codec_name,sample_rate,bits_per_raw_sample,bits_per_sample", "-of", "json", str(src)],
                       capture_output=True, text=True)
    st = (json.loads(r.stdout or "{}").get("streams") or [{}])[0]
    codec, sr = st.get("codec_name") or "", int(st.get("sample_rate") or 0)
    lossless = codec in ("alac", "flac") or codec.startswith("pcm_")
    if codec not in pl.get("unplayable_codecs", []) and not (lossless and sr > pl.get("max_sample_rate", 10**6)):
        return src
    bits = int(st.get("bits_per_raw_sample") or st.get("bits_per_sample") or 16)
    out = src.with_name(src.stem + ".aiff") if src.suffix.lower() not in (".aif", ".aiff") else src.with_name(src.stem + ".48k.aiff")
    # The player takes 44.1 or 48 kHz: anything else goes to the nearer one it can play.
    hi = pl.get("max_sample_rate", 48000)
    to_rate = None if sr in (44100, hi) or not sr else hi if sr > 44100 else 44100
    rate = ["-af", f"aresample={to_rate}:filter_size=64:phase_shift=10:cutoff=0.97"] if to_rate else []
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(src), "-map", "0:a:0", "-map", "0:v?", "-c:v", "copy",
                    "-map_metadata", "0", "-write_id3v2", "1", *rate, "-c:a", "pcm_s24be" if bits > 16 else "pcm_s16be", str(out)], check=True)
    a, b = probe(src), probe(out)
    if not (a and b and abs(a["duration"] - b["duration"]) < 0.1):
        out.unlink(missing_ok=True)
        return src
    src.unlink()
    return out


def tag_mismatch(req, path):
    """The file's own artist/title tags, when they clearly name a different song. Returns a reason or None."""
    r = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format_tags=artist,title", "-of", "json", str(path)], capture_output=True, text=True)
    tags = {k.lower(): v for k, v in (json.loads(r.stdout or "{}").get("format", {}).get("tags") or {}).items()}
    title, artist = tags.get("title", ""), tags.get("artist", "")
    if not title:
        return None
    # Tags are noisy (swapped fields, "&" for "and", odd spellings), so only a title that shares under half
    # of the requested title's words counts as a different song.
    words = set(Request("x", title).core_tokens) | set(norm(title).split()) | set(norm(artist).split())
    want = set(req.core_tokens) - STOP or set(req.core_tokens)
    if want and len(want & words) / len(want) < 0.5:
        return f"tags say '{artist} - {title}'"
    return None


# ---------------------------------------------------------------- network health

SLSKD_YML = Path("~/.local/share/slskd/slskd.yml").expanduser()


def port_check(renew=True):
    """(ok, message): the router forwards slskd's listen port to this Mac. Peers deliver files by connecting
    to that port, so if it points at another machine (say a Mac mini running Nicotine+), most transfers fail."""
    try:
        port = int(re.search(r"listen_port:\s*(\d+)", SLSKD_YML.read_text()).group(1))
    except Exception:
        return True, "slskd listen port unknown; skipped the router check"
    upnpc = shutil.which("upnpc") or "/opt/homebrew/bin/upnpc"
    if not Path(upnpc).exists():
        return True, "upnpc not installed; skipped the router check"
    lan = subprocess.run(["ipconfig", "getifaddr", "en0"], capture_output=True, text=True).stdout.strip() or \
        subprocess.run(["ipconfig", "getifaddr", "en1"], capture_output=True, text=True).stdout.strip()

    def mapping():
        try:
            out = subprocess.run([upnpc, "-l"], capture_output=True, text=True, timeout=25).stdout
        except subprocess.TimeoutExpired:
            return "timeout"
        m = re.search(rf"TCP\s+{port}->([\d.]+):(\d+)", out)
        return f"{m.group(1)}:{m.group(2)}" if m else None

    to = mapping()
    if to == "timeout":
        return True, "router didn't answer UPnP; couldn't check the port"
    if to and to != f"{lan}:{port}":
        return False, f"the router forwards Soulseek port {port} to {to}, not slskd on this Mac ({lan}:{port}); change listen_port in {SLSKD_YML} and rerun setup_slskd.py"
    if renew:
        try:
            subprocess.run([upnpc, "-e", "slskd", "-r", str(port), "TCP"], capture_output=True, timeout=25)
        except subprocess.TimeoutExpired:
            pass
    if not to:
        return True, f"the router showed no forwarding for port {port}" + (f"; asked it to map the port to this Mac ({lan})" if renew else "")
    return True, f"port {port} forwarded to this Mac ({lan})"


# ---------------------------------------------------------------- slskd

class SlskdUnavailable(RuntimeError):
    pass


class Slskd:
    def __init__(self, url, key):
        self.url, self.key = url.rstrip("/"), key

    def call(self, method, path, body=None, timeout=30):
        req = urllib.request.Request(self.url + "/api/v0" + path, method=method,
                                     data=None if body is None else json.dumps(body).encode(),
                                     headers={"X-API-Key": self.key, "Content-Type": "application/json"})
        for attempt in range(4):
            try:
                with urllib.request.urlopen(req, timeout=timeout) as r:
                    data = r.read()
                    return json.loads(data) if data else None
            except urllib.error.HTTPError as e:
                if e.code == 404:
                    return None
                if e.code >= 500 and attempt < 3 and method == "GET":
                    time.sleep(2 * (attempt + 1))
                    continue
                raise RuntimeError(f"slskd {method} {path}: {e.code} {e.read().decode(errors='replace')[:300]}") from None
            except (urllib.error.URLError, ConnectionError, TimeoutError, OSError) as e:
                # Connection resets happen when slskd is busy; GETs are safe to repeat, writes are not.
                if attempt < 3 and method == "GET":
                    time.sleep(2 * (attempt + 1))
                    continue
                raise SlskdUnavailable(f"slskd {method} {path}: {e}") from None

    def server(self):
        return self.call("GET", "/server")

    def start_search(self, text):
        sid = str(uuid.uuid4())
        # searchTimeout is left at slskd's default: the API documents it in seconds, but 0.26 passes it
        # to Soulseek.NET as milliseconds, so small values end searches instantly.
        self.call("POST", "/searches", {"id": sid, "searchText": text, "responseLimit": 300,
                                        "fileLimit": 5000, "filterResponses": True})
        return sid

    def search_state(self, sid):
        return self.call("GET", f"/searches/{sid}")

    def responses(self, sid):
        return self.call("GET", f"/searches/{sid}/responses") or []

    def delete_search(self, sid):
        try:
            self.call("DELETE", f"/searches/{sid}")
        except RuntimeError:
            pass

    def enqueue(self, username, filename, size):
        u = urllib.parse.quote(username, safe="")
        res = self.call("POST", f"/transfers/downloads/{u}", [{"filename": filename, "size": size}], timeout=90) or {}
        enq = res.get("enqueued") or res.get("Enqueued") or []
        if enq:
            return enq[0].get("id")
        failed = res.get("failed") or res.get("Failed") or ["enqueue failed"]
        raise RuntimeError(str(failed[0])[:200])

    def downloads(self, username):
        u = urllib.parse.quote(username, safe="")
        res = self.call("GET", f"/transfers/downloads/{u}") or {}
        return {f["id"]: f for d in res.get("directories", []) for f in d.get("files", [])}

    def directory(self, username, directory):
        u = urllib.parse.quote(username, safe="")
        return self.call("POST", f"/users/{u}/directory", {"directory": directory}, timeout=60) or []

    def browse(self, username):
        u = urllib.parse.quote(username, safe="")
        return self.call("GET", f"/users/{u}/browse", timeout=240) or []

    def cancel(self, username, tid):
        u = urllib.parse.quote(username, safe="")
        try:
            self.call("DELETE", f"/transfers/downloads/{u}/{tid}?remove=true")
        except RuntimeError:
            pass


class Pace:
    """Soulseek search pacing shared across processes."""

    def __init__(self):
        PACE_DB.parent.mkdir(parents=True, exist_ok=True)
        self.db = sqlite3.connect(PACE_DB, timeout=30, isolation_level=None)
        self.db.execute("create table if not exists searches (t real)")
        p = PREFS["soulseek"]
        self.limit, self.window = p["searches_per_window"], p["window_seconds"]

    def take(self):
        """Reserve a search slot if one is free now. Returns True when reserved."""
        now = time.time()
        self.db.execute("begin immediate")
        try:
            self.db.execute("delete from searches where t < ?", (now - 3600,))
            n = self.db.execute("select count(*) from searches where t > ?", (now - self.window,)).fetchone()[0]
            if n >= self.limit:
                self.db.execute("commit")
                return False
            self.db.execute("insert into searches values (?)", (now,))
            self.db.execute("commit")
            return True
        except Exception:
            self.db.execute("rollback")
            raise


# ---------------------------------------------------------------- state

SCHEMA = """
create table if not exists tracks (id text primary key, artist text, title text, row_json text, pos integer,
  status text, target_json text, sc_json text, qidx integer default 0, sc_tried integer default 0,
  source text, final_path text, note text, updated real);
create table if not exists searches (track text, query text, search_id text, files integer, ok integer, created real);
create table if not exists candidates (track text, username text, filename text, size integer, length integer,
  bitrate integer, ext text, ok integer, score real, notes text, peer_json text, primary key (track, username, filename));
create table if not exists seeds (query text primary key, files integer, matched integer, created real);
create table if not exists attempts (track text, username text, filename text, transfer_id text, state text,
  started real, ended real, detail text, primary key (track, username, filename));
"""


def open_db(list_dir):
    (list_dir / "_state").mkdir(parents=True, exist_ok=True)
    db = sqlite3.connect(list_dir / "_state/state.sqlite", timeout=60, check_same_thread=False)
    db.row_factory = sqlite3.Row
    db.execute("pragma journal_mode=wal")
    db.executescript(SCHEMA)
    return db


def set_status(db, tid, status, **fields):
    fields["status"], fields["updated"] = status, time.time()
    cols = ", ".join(f"{k}=?" for k in fields)
    db.execute(f"update tracks set {cols} where id=?", (*fields.values(), tid))
    db.commit()


def read_rows(path):
    p = Path(path).expanduser()
    if p.suffix.lower() == ".csv":
        rows = list(csv.DictReader(p.open(newline="", encoding="utf-8-sig")))
        lower = [{k.lower().strip(): (v or "").strip() for k, v in r.items() if k} for r in rows]
        return [r for r in lower if r.get("artist") and r.get("title")]
    out = []
    for line in p.read_text().splitlines():
        if " - " in line.strip():
            a, t = line.strip().split(" - ", 1)
            out.append({"artist": a, "title": t})
    return out


def add_tracks(db, rows):
    pos = db.execute("select coalesce(max(pos), 0) from tracks").fetchone()[0]
    added = 0
    for r in rows:
        tid = track_id(r["artist"], r["title"])
        if db.execute("select 1 from tracks where id=?", (tid,)).fetchone():
            continue
        pos += 1
        db.execute("insert into tracks (id, artist, title, row_json, pos, status, updated) values (?,?,?,?,?, 'pending', ?)",
                   (tid, r["artist"], r["title"], json.dumps(r), pos, time.time()))
        added += 1
    db.commit()
    return added


# ---------------------------------------------------------------- library index

def build_have_index(dirs, exclude):
    idx = []
    for d in dirs:
        if not d.exists():
            continue
        for root, subdirs, files in os.walk(d):
            subdirs[:] = [s for s in subdirs if not s.startswith(".") and s not in ("_rejected", "_replaced", "_review", "_state")]
            if any(Path(root).is_relative_to(e) for e in exclude):
                continue
            for fn in files:
                stem, _, ext = fn.rpartition(".")
                if ext.lower() in AUDIO_EXTS:
                    idx.append((set(norm(stem).split()), norm(stem), Path(root) / fn))
    return idx


def find_have(req, idx, target_len):
    tol = PREFS["versions"]["length_tolerance_seconds"]
    need = set(req.core_tokens) | set(req.remixer_tokens)
    for name_set, name_norm, path in idx:
        if not need <= name_set:
            continue
        if not any(set(tokens(a)) <= name_set for a in req.artists):
            continue
        ok, _, _ = evaluate(req, {"filename": path.name, "bitRate": 320}, None)
        if not ok:
            continue
        info = probe(path)
        if not info:
            continue
        if target_len and abs(info["duration"] - target_len) > tol:
            continue
        return path, info
    return None, None


# ---------------------------------------------------------------- soundcloud

def zen_cookies(cfg, host_like):
    """Cookies from the configured Firefox-family profile (Zen), read without locking the live database."""
    prof = cfg.get("soundcloud", {}).get("profile")
    if not prof:
        return []
    db = sqlite3.connect(f"file:{Path(prof) / 'cookies.sqlite'}?immutable=1", uri=True)
    rows = db.execute("select host, name, value, path, expiry, isSecure, isHttpOnly, sameSite from moz_cookies where host like ?", (host_like,)).fetchall()
    db.close()
    return [{"domain": h, "name": n, "value": v, "path": p, "expires": e if e and e < 2**31 else -1, "secure": bool(sec),
             "httpOnly": bool(ho), "sameSite": {0: "None", 1: "Lax", 2: "Strict"}.get(ss, "None")} for h, n, v, p, e, sec, ho, ss in rows]


class SoundCloud:
    """SoundCloud's web API (api-v2), signed in with Aaron's Zen session."""
    API = "https://api-v2.soundcloud.com"
    CID_CACHE = Path("~/.local/share/dj-fetch/sc_client_id").expanduser()

    def __init__(self, cfg):
        tok = next((c["value"] for c in zen_cookies(cfg, "%soundcloud.com") if c["name"] == "oauth_token"), None)
        self.headers = {"Authorization": f"OAuth {tok}"} if tok else {}
        self.cid = self.CID_CACHE.read_text().strip() if self.CID_CACHE.exists() and time.time() - self.CID_CACHE.stat().st_mtime < 86400 else None
        self.lock, self.last = threading.Lock(), 0.0

    def client_id(self, refresh=False):
        if self.cid and not refresh:
            return self.cid
        from curl_cffi import requests
        home = requests.get("https://soundcloud.com/", impersonate="chrome", timeout=20).text
        for src in reversed(re.findall(r'<script crossorigin src="(https://a-v2\.sndcdn\.com/assets/[^"]+\.js)"', home)):
            m = re.search(r'client_id\s*:\s*"([a-zA-Z0-9]{32})"', requests.get(src, impersonate="chrome", timeout=20).text)
            if m:
                self.cid = m.group(1)
                self.CID_CACHE.parent.mkdir(parents=True, exist_ok=True)
                self.CID_CACHE.write_text(self.cid)
                return self.cid
        raise RuntimeError("couldn't find a SoundCloud client_id")

    def get(self, path, **params):
        from curl_cffi import requests
        url = path if path.startswith("http") else self.API + path
        for attempt in range(5):
            with self.lock:
                wait = 0.35 - (time.time() - self.last)
                if wait > 0:
                    time.sleep(wait)
                self.last = time.time()
            r = requests.get(url, params={**params, "client_id": self.client_id()}, headers=self.headers, impersonate="chrome", timeout=30)
            if r.status_code == 200:
                return r.json()
            if r.status_code == 401 and attempt == 0:
                self.client_id(refresh=True)
            elif r.status_code in (429, 500, 502, 503):
                time.sleep(5 * (attempt + 1))
            elif r.status_code == 404:
                return None
            else:
                raise RuntimeError(f"SoundCloud {path}: {r.status_code} {r.text[:200]}")
        raise RuntimeError(f"SoundCloud {path}: gave up")

    def search(self, q, limit=20):
        return [t for t in (self.get("/search/tracks", q=q, limit=limit) or {}).get("collection", []) if t.get("kind") == "track"]

    def resolve(self, url):
        m = re.search(r"api\.soundcloud\.com/tracks/(\d+)", url)
        if m:
            return self.get(f"/tracks/{m.group(1)}", **({"secret_token": st.group(1)} if (st := re.search(r"secret_token=([\w-]+)", url)) else {}))
        res = self.get("/resolve", url=url.split("?")[0])
        return res if res and res.get("kind") == "track" else None

    def download_url(self, track):
        res = self.get(f"/tracks/{track['id']}/download")
        return (res or {}).get("redirectUri")

    def download(self, track, dest_dir):
        """The uploader's original file via SoundCloud's own download button."""
        u = self.download_url(track)
        return download_to(u, dest_dir) if u else None


URL_RE = re.compile(r"(?:https?://|www\.)[^\s<>\"'\])]+|\b(?:[\w-]+\.)?(?:hypeddit\.com|toneden\.io|droploud\.com|pumpyoursound\.com|fanlink\.(?:to|tv)|ffm\.to|gate\.fm|bit\.ly|we\.tl|wetransfer\.com|dropbox\.com|drive\.google\.com|mediafire\.com|mega\.nz|lnk\.to|linktr\.ee|smarturl\.it|edmdisc\.com|feature\.fm|hive\.co|bandcamp\.com|dl\.gate\.fm)/[^\s<>\"'\])]+", re.I)
SHORTENERS = re.compile(r"https?://(?:www\.)?(?:bit\.ly|tinyurl\.com|t\.co|ow\.ly|rebrand\.ly|cutt\.ly|is\.gd|buff\.ly|shorturl\.at|tiny\.cc|goo\.gl)/", re.I)
FILE_HOST_RE = re.compile(r"https?://(?:[\w-]+\.)?(?:dropbox\.com|dropboxusercontent\.com|drive\.google\.com|docs\.google\.com|we\.tl|wetransfer\.com|mediafire\.com|mega\.nz|mega\.co\.nz|box\.com|1drv\.ms|onedrive\.live\.com|pcloud\.link|u\.pcloud\.link|files\.fm|sendspace\.com)/", re.I)
# Sites that exist to gate free downloads. Smartlink sites (lnk.to, ffm.to, linktr.ee...) usually point to
# streaming, so they only count when the Buy button or the description line says it's a free download.
GATE_RE = re.compile(r"https?://(?:[\w-]+\.)?(?:hypeddit\.com|toneden\.io|droploud\.com|pumpyoursound\.com|gaterush\.me|gate\.fm|edmdisc\.com|hive\.co|unlock\.[\w.]+|repostexchange\.com|bandcamp\.com|fanlink\.(?:to|tv)/[^/]*(?:dl|download|free))", re.I)
FREE_LABEL = re.compile(r"free|download|\bdl\b|\bfdl\b", re.I)
STREAM_ONLY = re.compile(r"https?://(?:[\w-]+\.)?(?:spotify\.com|apple\.com|music\.apple|youtube\.com|youtu\.be|instagram\.com|tiktok\.com|twitter\.com|x\.com|facebook\.com|beatport\.com|traxsource\.com|deezer\.com|tidal\.com|amazon\.|patreon\.com)/", re.I)


def track_links(t):
    """Every link on a SoundCloud track that might lead to a free download: the Buy button first, then the description."""
    out = []
    if t.get("purchase_url"):
        out.append(("buy", t["purchase_url"], t.get("purchase_title") or ""))
    for line in (t.get("description") or "").splitlines():
        for m in URL_RE.finditer(line):
            u = m.group(0).rstrip(".,;:!?")
            out.append(("description", u if u.lower().startswith("http") else "https://" + u, line))
    seen, res = set(), []
    for where, u, label in out:
        key = re.sub(r"^https?://(?:www\.)?", "", u).rstrip("/").lower()
        if key not in seen:
            seen.add(key)
            res.append((where, u, label))
    return res


def expand_url(u):
    if not SHORTENERS.match(u):
        return u
    try:
        from curl_cffi import requests
        return requests.get(u, impersonate="chrome", timeout=15, allow_redirects=True).url or u
    except Exception:
        return u


def classify_link(u, label=""):
    if FILE_HOST_RE.match(u):
        return "file"
    if GATE_RE.match(u):
        return "gate"
    if STREAM_ONLY.match(u) or re.match(r"https?://(?:[\w-]+\.)?soundcloud\.com/", u, re.I):
        return None
    if FREE_LABEL.search(label or ""):
        return "gate"  # a smartlink or unknown site labelled "Free Download" is still worth a try
    return None


def sc_title_ok(req, t):
    """Version rules for a SoundCloud upload, from its title and uploader (no file to inspect yet)."""
    title = t.get("title") or ""
    user = (t.get("user") or {}).get("username") or ""
    tn = norm(title)
    words, both = set(tn.split()), set(norm(f"{title} {user}").split())
    if any(has_phrase(tn, m) for m in PREFS["versions"]["rip_markers"]):
        return False
    if not req.core_tokens or not set(req.core_tokens) <= words:
        return False
    if req.remixer_tokens and not set(req.remixer_tokens) <= both:
        return False
    if not (any(set(tokens(a)) <= both for a in req.artists) or req.remixer_tokens):
        return False
    if req.kind and not (req.kind == "remix" and req.remixer_tokens) and not has_phrase(tn, req.kind):
        return False  # a requested VIP, bootleg or edit must be named; the original upload is another version
    for m in PREFS["versions"]["unrequested_markers"]:
        if has_phrase(tn, m) and not has_phrase(norm(req.label), m) and not has_phrase(norm(req.core), m):
            if m == "edit" and has_phrase(tn, "extended edit"):
                continue
            return False
    m = re.search(r"[\(\[][^\)\]]*\b(remix|bootleg|edit|flip|mashup)\b", title, re.I)
    if m and not req.wants_named_version and not has_phrase(norm(req.label), m.group(1)):
        return False
    return True


def sc_candidates(sc, req, row, target_len):
    """SoundCloud uploads of the requested version with a free download, best first."""
    found, seen = [], set()
    for u in sc_urls(row):
        try:
            t = sc.resolve(u)
        except Exception:
            t = None
        if t and t.get("id") not in seen:
            seen.add(t["id"])
            found.append((True, t))
    queries = [" ".join([*tokens(req.primary), *req.core_tokens, *req.remixer_tokens])]
    if req.remixer_tokens:
        queries.append(" ".join([*req.core_tokens, *req.remixer_tokens]))
    for qy in dict.fromkeys(queries):
        for t in sc.search(qy, limit=20):
            if t.get("id") not in seen:
                seen.add(t["id"])
                found.append((False, t))
    tol = PREFS["versions"]["length_tolerance_seconds"]
    names = [set(tokens(a)) for a in req.artists] + ([set(req.remixer_tokens)] if req.remixer_tokens else [])
    out = []
    for linked, t in found:
        if not sc_title_ok(req, t):
            continue
        offers = sc_offers(t)
        user = set(norm(f"{(t.get('user') or {}).get('username', '')} {(t.get('user') or {}).get('permalink', '')}").split())
        dur = (t.get("duration") or 0) / 1000
        score = 200 * bool(offers) + 100 * linked + 50 * any(n and n <= user for n in names) + 40 * ("extended" in norm(t.get("title", "")).split())
        if target_len and dur:
            score += 60 if abs(dur - target_len) <= tol else -20
        elif dur:
            score += min(dur, 600) / 20
        out.append({"score": score, "track": t, "offers": offers, "url": t.get("permalink_url"), "title": t.get("title"),
                    "user": (t.get("user") or {}).get("username")})
    out.sort(key=lambda c: -c["score"])
    return out


def sc_offers(t):
    """[(kind, url, where)] for one SoundCloud track: 'direct' (SoundCloud's own button), 'file' or 'gate'."""
    offers = []
    if t.get("downloadable") and t.get("has_downloads_left", True):
        offers.append(("direct", t.get("permalink_url"), "download button"))
    for where, u, label in track_links(t):
        u = expand_url(u)
        kind = classify_link(u, label)
        if kind:
            offers.append((kind, u, where))
    return offers


def pick_extended(paths):
    """From several downloaded files, keep the extended version in the best format; delete the rest.
    Extended = labelled extended, else the longest. Same version in several formats = preferences' format order."""
    infos = [(p, probe(p)) for p in paths]
    infos = [(p, i) for p, i in infos if i]
    if not infos:
        return None
    labelled = [x for x in infos if "extended" in norm(x[0].stem).split()]
    pool = labelled or infos
    longest = max(i["duration"] for _, i in pool)
    same = [x for x in pool if longest - x[1]["duration"] <= 3]
    order = PREFS["formats"]["order"]
    rank = lambda p: order.index(p.suffix.lower().lstrip(".")) if p.suffix.lower().lstrip(".") in order else len(order)
    best = min(same, key=lambda x: rank(x[0]))[0]
    for p, _ in infos:
        if p != best:
            p.unlink(missing_ok=True)
    return best


def unpack_audio(path, dest_dir):
    """Unzip if needed and keep the extended version (see pick_extended). Returns an audio path or None."""
    import zipfile
    if zipfile.is_zipfile(path):
        out = []
        with zipfile.ZipFile(path) as z:
            for i in z.infolist():
                if i.filename.rpartition(".")[2].lower() in AUDIO_EXTS and "__MACOSX" not in i.filename:
                    target = dest_dir / safe_name(file_basename(i.filename))
                    target.write_bytes(z.read(i))
                    out.append(target)
        path.unlink()
        return pick_extended(out)
    return path if path and probe(path) else None


GATE_ACTION = re.compile(r"\b(follow|like|repost|comment|subscribe|pre-?save|instagram|spotify|youtube|tiktok|twitter|facebook|bandcamp|mixcloud|connect)\b", re.I)
GATE_PROGRESS = re.compile(r"\b(download|next|continue|unlock|get (?:it|track|file|download|access)|submit|share (?:my )?email|i.?ve done|i did it|did it|done|claim|skip|proceed|send|confirm|verify|go)\b", re.I)
SOCIAL_HREF = re.compile(r"https?://(?:[\w-]+\.)?(?:instagram\.com|spotify\.com|open\.spotify|youtube\.com|youtu\.be|tiktok\.com|twitter\.com|x\.com|facebook\.com|soundcloud\.com|twitch\.tv|mixcloud\.com|bandcamp\.com|threads\.net)/", re.I)
GATE_NEVER = re.compile(r"\b(buy|purchase|pay|donat|tip|checkout|cart|wishlist|sign ?up for|log ?out|privacy|terms|help|dmca|cookie settings|report|top 100|more free|see all|login with email|join free|join \w+|discover|charts|shop|how it works|view profile|dismiss)\b", re.I)
IN_CHROME = "e => !!e.closest('nav, header, footer, [role=navigation], [class*=navbar], [class*=menu]')"
AUDIO_URL = re.compile(r"\.(?:wav|mp3|aiff?|flac|m4a|zip)(?:[?#]|$)", re.I)


class GateBrowser:
    """A Playwright Firefox carrying Aaron's Zen cookies (SoundCloud, Google, Spotify). Use from one thread."""

    def __init__(self, cfg, headless=True):
        from playwright.sync_api import sync_playwright
        self.cfg = cfg
        self.pw = sync_playwright().start()
        try:
            self.browser = self.pw.firefox.launch(headless=headless)
        except Exception:
            subprocess.run([sys.executable, "-m", "playwright", "install", "firefox"], check=True)
            self.browser = self.pw.firefox.launch(headless=headless)

    STATE = Path("~/.local/share/dj-fetch/browser-state.json").expanduser()

    def context(self):
        state = str(self.STATE) if self.STATE.exists() else None
        ctx = self.browser.new_context(viewport={"width": 1280, "height": 900}, accept_downloads=True, locale="en-US", storage_state=state)
        cookies = []
        for host in ("%soundcloud.com", "%google.com", "%youtube.com", "%spotify.com"):
            cookies += zen_cookies(self.cfg, host)
        ctx.add_cookies([{k: c[k] for k in ("name", "value", "domain", "path", "expires", "secure", "httpOnly", "sameSite")} for c in cookies])
        return ctx

    def save(self, ctx):
        """Keep gate-site logins (Droploud, PumpYourSound...) for the next run."""
        self.STATE.parent.mkdir(parents=True, exist_ok=True)
        ctx.storage_state(path=str(self.STATE))
        self.STATE.chmod(0o600)

    def close(self):
        try:
            self.browser.close()
            self.pw.stop()
        except Exception:
            pass


def site_password(host, create=True):
    """Per-site password for gate-site accounts, kept in the macOS Keychain (service dj-fetch:<host>)."""
    import secrets
    host = re.sub(r"^www\.", "", host.lower())
    r = subprocess.run(["security", "find-generic-password", "-s", f"dj-fetch:{host}", "-w"], capture_output=True, text=True)
    if r.returncode == 0:
        return r.stdout.strip()
    if not create:
        return None
    pw = secrets.token_urlsafe(14) + "!9a"
    subprocess.run(["security", "add-generic-password", "-s", f"dj-fetch:{host}", "-a", "dj-fetch", "-w", pw, "-U"], check=True)
    return pw


def sc_support_state(sc, track):
    """(liked, reposted) for Aaron's account, so clicks never toggle an action off."""
    me = sc.get("/me") or {}
    likes = sc.get("/me/track_likes/ids", limit=5000) or []
    likes = likes.get("collection", []) if isinstance(likes, dict) else likes
    reposts = sc.get(f"/stream/users/{me.get('id')}/reposts", limit=200) or {}
    reposted = any((c.get("track") or {}).get("id") == track["id"] for c in reposts.get("collection", []))
    return track["id"] in likes, reposted


def sc_support_in_browser(ctx, sc_url, cfg, log=print):
    """Follow the uploader, like and repost on SoundCloud's own page, for gates that verify these.
    SoundCloud's track page draws these buttons inside a frame (/n/...) without pressed state, so the
    current state comes from the API and only missing actions are clicked."""
    sc = SoundCloud(cfg)
    track = sc.resolve(sc_url)
    if not track:
        return []
    liked, reposted = sc_support_state(sc, track)
    pg = ctx.new_page()
    done = []
    try:
        pg.goto(sc_url, wait_until="domcontentloaded", timeout=45000)
        pg.wait_for_timeout(5000)
        frame = next((f for f in pg.frames if "/n/" in f.url), pg.main_frame)
        for name, skip in (("Like", liked), ("Repost", reposted), ("Follow", False)):
            if skip:
                continue
            btn = frame.locator(f"button[aria-label='{name}']").first
            if btn.count():
                btn.click(timeout=5000)
                pg.wait_for_timeout(1500)
                done.append(name.lower())
        liked2, reposted2 = sc_support_state(sc, track)
        log(f"  gate: SoundCloud now liked={liked2} reposted={reposted2}")
    except Exception as e:
        log(f"  gate: SoundCloud support error: {str(e)[:100]}")
    finally:
        pg.close()
    return done


def solve_gate(gb, url, dest_dir, log=print, timeout=150, sc_url=None):
    """Work through a free-download gate like a person would. Social steps are opened and closed, not followed.
    Returns (path, note) or (None, reason)."""
    g = gb.cfg.get("gates", {})
    email, name = g.get("email"), g.get("name", "Aaron")
    dest_dir.mkdir(parents=True, exist_ok=True)
    ctx = gb.context()
    downloads, file_urls, oauth_pages, on_auth = [], [], [], [False]

    def watch(pg):
        pg.on("download", lambda d: downloads.append(d))
        pg.on("response", lambda r: file_urls.append(r.url) if r.status == 200 and (
            AUDIO_URL.search(r.url.split("?")[0]) or (r.headers.get("content-type", "").startswith(("audio/", "application/zip", "application/octet-stream")))) else None)

    ctx.on("page", watch)
    page = ctx.new_page()
    try:
        page.goto(url, wait_until="domcontentloaded", timeout=45000)
        page.wait_for_timeout(3000)
        clicked, progress_clicks, end, rnd = set(), collections.Counter(), time.time() + timeout, 0
        gate_host = urllib.parse.urlparse(page.url).hostname or ""
        gate_path = urllib.parse.urlparse(page.url).path
        debug = os.environ.get("DJ_GATE_DEBUG")
        while time.time() < end:
            rnd += 1
            if debug:
                try:
                    page.screenshot(path=str(dest_dir / f"_dbg{rnd:02d}.png"))
                except Exception:
                    pass
            if downloads:
                page.wait_for_timeout(6000)  # some gates hand out several files (extended, radio, formats)
                got = []
                while downloads:
                    d = downloads.pop(0)
                    path = dest_dir / safe_name(d.suggested_filename or "gate-download")
                    d.save_as(path)
                    if (one := unpack_audio(path, dest_dir)):
                        got.append(one)
                best = pick_extended(got) if got else None
                if best:
                    gb.save(ctx)
                    return best, f"gate download ({file_basename(page.url)}{f', picked from {len(got)} files' if len(got) > 1 else ''})"
            for fu in list(dict.fromkeys(file_urls)):
                file_urls.remove(fu)
                if "soundcloud.com" in fu or "sndcdn" in fu:
                    continue  # SoundCloud previews and streams aren't the download
                try:
                    r = ctx.request.get(fu, timeout=300000)
                    if r.ok and len(r.body()) > 500_000:
                        name_guess = re.search(r"filename\*?=(?:UTF-8'')?\"?([^\";]+)", r.headers.get("content-disposition", ""))
                        path = dest_dir / safe_name(urllib.parse.unquote(name_guess.group(1) if name_guess else fu.split("?")[0].rsplit("/", 1)[-1]) or "gate-download.bin")
                        path.write_bytes(r.body())
                        got = unpack_audio(path, dest_dir)
                        if got and (info := probe(got)) and info["duration"] >= 90:
                            return got, "gate file link"
                        if got:  # a preview the page played, not the download: keep working the gate
                            got.unlink(missing_ok=True)
                except Exception:
                    pass
            # Popups: SoundCloud/Spotify consent screens get approved, everything else is opened and closed.
            for pg in ctx.pages[1:]:
                try:
                    if re.search(r"(soundcloud\.com/connect|secure\.soundcloud\.com|accounts\.spotify\.com/.*authorize|accounts\.google\.com/o/oauth2)", pg.url):
                        if pg not in oauth_pages:
                            oauth_pages.append(pg)
                            pg.wait_for_timeout(2500)
                            for txt in ("Connect and continue", "Connect", "Allow", "Agree", "Continue", "Accept"):
                                btn = pg.get_by_role("button", name=re.compile(txt, re.I))
                                if btn.count() and btn.first.is_visible():
                                    btn.first.click()
                                    log(f"  gate: approved {pg.url.split('?')[0][:60]}")
                                    break
                        continue
                    if FILE_HOST_RE.match(pg.url):
                        got = fetch_file_host(pg.url, dest_dir)
                        if got:
                            return got, f"gate file host ({pg.url.split('/')[2]})"
                    pg.close()
                except Exception:
                    pass
            page.bring_to_front()
            here = urllib.parse.urlparse(page.url)
            if here.hostname == gate_host and here.path != gate_path and not re.search(r"auth|login|register|sign|download|unlock|success|thank", here.path, re.I):
                log(f"  gate: wandered to {here.path}, going back")
                page.go_back(wait_until="domcontentloaded")
                page.wait_for_timeout(1500)
                continue
            for txt in ("Accept all", "Accept All", "Accept", "I agree", "Agree", "Got it", "OK", "Allow all"):
                b = page.get_by_role("button", name=txt, exact=True)
                if b.count() and b.first.is_visible():
                    try:
                        b.first.click(timeout=2000)
                    except Exception:
                        pass
            # Forms.
            for inp in page.query_selector_all("input:visible, textarea:visible"):
                try:
                    kind = (inp.get_attribute("type") or "text").lower()
                    hint = " ".join(filter(None, [inp.get_attribute(a) for a in ("name", "id", "placeholder", "aria-label", "autocomplete")])).lower()
                    if kind == "password":
                        if not inp.input_value():
                            inp.fill(site_password(urllib.parse.urlparse(page.url).hostname or ""))
                            on_auth[0] = True
                    elif kind == "checkbox":
                        if not inp.is_checked():
                            inp.check(timeout=2000)
                    elif kind in ("email",) or "email" in hint or "e-mail" in hint:
                        if email and not inp.input_value():
                            inp.fill(email)
                    elif "name" in hint and "user" not in hint and kind == "text":
                        if not inp.input_value():
                            inp.fill(name)
                    elif inp.evaluate("e => e.tagName") == "TEXTAREA" and "comment" in hint and not inp.input_value():
                        inp.fill("🔥")
                except Exception:
                    pass
            # Styled checkboxes hide the real input; tick consent boxes through force or their label.
            for cb in page.query_selector_all("input[type=checkbox]"):
                try:
                    if cb.is_checked() or cb.evaluate(IN_CHROME):
                        continue
                    # Click the visible label first: forcing the hidden input doesn't tell React-style forms.
                    cb.evaluate("e => (e.closest('label') || document.querySelector(`label[for='${e.id}']`) || e).click()")
                    page.wait_for_timeout(300)
                    if not cb.is_checked():
                        cb.check(force=True, timeout=2000)
                except Exception:
                    pass
            # Direct file links on the page.
            for a in page.query_selector_all("a[href]:visible"):
                href = a.get_attribute("href") or ""
                if FILE_HOST_RE.match(href) and href not in clicked:
                    clicked.add(href)
                    got = fetch_file_host(href, dest_dir)
                    if got:
                        return got, f"gate file host ({href.split('/')[2]})"
            # Social steps: open each once.
            acted = False
            for el in page.query_selector_all("a:visible, button:visible, [role=button]:visible"):
                try:
                    text = " ".join((el.inner_text() or el.get_attribute("aria-label") or el.get_attribute("title") or "").split())[:80]
                    cls = el.get_attribute("class") or ""
                    key = text + "|" + (el.get_attribute("href") or "") + "|" + cls[:40]
                    if key in clicked or GATE_NEVER.search(text) or not text and not re.search(r"soundcloud|spotify|instagram|youtube|social", cls, re.I):
                        continue
                    href = el.get_attribute("href") or ""
                    internal = bool(href) and not href.startswith(("http", "javascript", "#")) or (gate_host and gate_host in href)
                    if internal and not GATE_ACTION.search(text):
                        continue  # a link elsewhere on the same site (shop, profiles), not a gate step
                    social = GATE_ACTION.search(text) or re.search(r"btn-(?:soundcloud|spotify|instagram|youtube|social)", cls, re.I) \
                        or SOCIAL_HREF.match(href) or (text.startswith("@") and (href.startswith("http") or not href)) or text.endswith("↗")
                    if social and not GATE_PROGRESS.search(text) and not el.evaluate(IN_CHROME):
                        clicked.add(key)
                        el.click(timeout=3000)
                        page.wait_for_timeout(1500)
                        acted = True
                except Exception:
                    pass
            if acted:
                continue
            # Progress: prefer Download, then the rest; each button a few times at most.
            cands = []
            for el in page.query_selector_all("a:visible, button:visible, [role=button]:visible, input[type=submit]:visible"):
                try:
                    text = " ".join((el.inner_text() or el.get_attribute("value") or el.get_attribute("aria-label") or "").split())[:60]
                    auth_btn = on_auth[0] and re.search(r"\b(sign ?up|register|create account|log ?in|sign ?in)\b", text or "", re.I)
                    if text and (auth_btn or GATE_PROGRESS.search(text)) and (auth_btn or not GATE_NEVER.search(text)) and (auth_btn or not el.evaluate(IN_CHROME)):
                        key = text + "|" + (el.get_attribute("id") or "")
                        if progress_clicks[key] < 3:
                            cands.append((0 if re.search(r"download", text, re.I) else 1, key, el))
                except Exception:
                    pass
            if not cands:
                page.wait_for_timeout(2000)
                continue
            cands.sort(key=lambda c: c[0])
            _, key, el = cands[0]
            if sc_url and "verify" in key.lower() and not progress_clicks[key]:
                log(f"  gate: verified step; on SoundCloud did {sc_support_in_browser(ctx, sc_url, gb.cfg, log) or 'nothing new'}")
                page.bring_to_front()
            progress_clicks[key] += 1
            try:
                el.click(timeout=4000)
            except Exception:
                try:
                    el.evaluate("e => e.click()")
                except Exception:
                    pass
            page.wait_for_timeout(3000)
        return None, f"gate not solved in {timeout}s (last page {page.url[:80]})"
    finally:
        try:
            page.screenshot(path=str(dest_dir / "_last_gate.png"))
        except Exception:
            pass
        ctx.close()


def sc_urls(row):
    out = []
    for raw in re.split(r"\s*\|\s*", row.get("soundcloud") or ""):
        if not raw:
            continue
        if "w.soundcloud.com/player" in raw:
            u = urllib.parse.parse_qs(urllib.parse.urlparse(raw).query).get("url", [""])[0]
            raw = u
        if "soundcloud.com" in raw:
            out.append(raw)
    return out


def fetch_file_host(url, dest_dir):
    """Download a free file shared on Dropbox or Google Drive; unzip if needed. Returns an audio path or None."""
    import zipfile
    from curl_cffi import requests
    if "dropbox" in url:
        url = re.sub(r"([?&])dl=0", r"\1dl=1", url) if "dl=0" in url else url + ("&" if "?" in url else "?") + "dl=1"
    elif "google.com" in url:
        m = re.search(r"/d/([\w-]+)|[?&]id=([\w-]+)", url)
        if not m:
            return None
        url = f"https://drive.usercontent.google.com/download?id={m.group(1) or m.group(2)}&export=download&confirm=t"
    return download_to(url, dest_dir)


def download_to(url, dest_dir, headers=None):
    """GET a file into dest_dir (name from Content-Disposition), unpack zips, keep it only if it's audio."""
    from curl_cffi import requests
    dest_dir.mkdir(parents=True, exist_ok=True)
    r = requests.get(url, impersonate="chrome", timeout=600, allow_redirects=True, headers=headers or {})
    if r.status_code != 200 or len(r.content) < 500_000:
        return None
    cd = r.headers.get("content-disposition", "")
    name = (re.search(r"filename\*?=(?:UTF-8'')?\"?([^\";]+)", cd) or [None, url.split("?")[0].rsplit("/", 1)[-1] or "download.bin"])[1]
    path = dest_dir / safe_name(urllib.parse.unquote(name))
    path.write_bytes(r.content)
    return unpack_audio(path, dest_dir)


# ---------------------------------------------------------------- the run

class Runner:
    def __init__(self, cfg, list_name, args):
        self.cfg, self.args = cfg, args
        self.dir = cfg["library_root"] / safe_name(list_name)
        for sub in ("", "_review", "_rejected", "_state"):
            (self.dir / sub).mkdir(parents=True, exist_ok=True)
        self.db = open_db(self.dir)
        self.lock = threading.Lock()
        self.slsk = Slskd(cfg["slskd"]["url"], cfg["slskd"]["api_key"])
        self.incoming = Path(cfg["slskd"]["downloads_dir"]).expanduser()
        self.prefs = PREFS["soulseek"]
        self.log_file = (self.dir / "_state/run.log").open("a")
        self.bad_peers = {}
        # Every file seen this run, indexed by filename token, so any search, folder listing or
        # browse can serve every track in the list. Searches are the scarce resource; this saves them.
        self.pool_index, self.pool_keys, self.pool_lock = {}, set(), threading.Lock()
        self.peer_info, self.peer_hits = {}, collections.defaultdict(set)
        self.harvest_q, self.harvested, self.browses = collections.deque(), set(), 0
        self.stop = threading.Event()

    def log(self, msg):
        line = time.strftime("%H:%M:%S ") + msg
        print(line, flush=True)
        self.log_file.write(line + "\n")
        self.log_file.flush()

    def q(self, sql, args=()):
        with self.lock:
            cur = self.db.execute(sql, args)
            rows = cur.fetchall()
            self.db.commit()
            return rows

    def status(self, tid, status, **fields):
        with self.lock:
            set_status(self.db, tid, status, **fields)

    def req_of(self, row):
        return Request(row["artist"], row["title"])

    def target(self, row):
        return json.loads(row["target_json"]) if row["target_json"] else None

    def dest_name(self, row, ext):
        title = row["title"]
        t = self.target(row)
        if t and t.get("mix_name") and norm(t["mix_name"]) not in norm(title):
            mix = t["mix_name"]
            if not (Request(row["artist"], title).remixer_tokens and "remix" in norm(mix)):
                title = f"{title} ({mix})"
        return safe_name(f"{row['artist']} - {title}") + "." + ext.lower()

    def place(self, row, src, sub=""):
        src = player_ready(src)
        dest_dir = self.dir / sub if sub else self.dir
        dest = dest_dir / self.dest_name(row, src.suffix.lstrip("."))
        i = 2
        while dest.exists():
            dest = dest.with_name(f"{dest.stem} ({i}){dest.suffix}")
            i += 1
        shutil.move(str(src), dest)
        parent = src.parent
        while parent != self.incoming and parent.is_relative_to(self.incoming) and not any(parent.iterdir()):
            parent.rmdir()
            parent = parent.parent
        return dest

    # ---- shared candidate pool
    def pool_add(self, peer, files, base_dir=None):
        new = []
        for f in files:
            fn = f.get("filename") or ""
            if base_dir and not re.search(r"[\\/]", fn):
                fn = base_dir.rstrip("\\/") + "\\" + fn
            key = (peer["username"], fn)
            ext = (f.get("extension") or fn.rpartition(".")[2]).lower().lstrip(".")
            if key in self.pool_keys or ext not in AUDIO_EXTS:
                continue
            self.pool_keys.add(key)
            stem = file_basename(fn).rpartition(".")[0] or file_basename(fn)
            new.append({"username": peer["username"], "filename": fn, "size": f.get("size"), "length": f.get("length"),
                        "bitRate": f.get("bitRate"), "extension": ext, "peer": peer, "name_set": set(norm(stem).split())})
        with self.pool_lock:
            for e in new:
                for tok in e["name_set"]:
                    self.pool_index.setdefault(tok, []).append(e)
        return new

    def record_matches(self, matches):
        """matches: [(row, entry, score, notes)]. Returns the set of track ids that gained candidates."""
        gained = set()
        with self.lock:
            for row, e, score, notes in matches:
                cur = self.db.execute("insert or ignore into candidates values (?,?,?,?,?,?,?,?,?,?,?)",
                                      (row["id"], e["username"], e["filename"], e["size"], e["length"], e["bitRate"], e["extension"],
                                       1, score, "; ".join(notes + ["found via pool"]), json.dumps(e["peer"])))
                if cur.rowcount:
                    gained.add(row["id"])
                    self.peer_hits[e["username"]].add(row["id"])
            self.db.commit()
        for tid in gained:
            self.q("update tracks set status='transfer', updated=? where id=? and status in ('search','missing')", (time.time(), tid))
        for user, hits in list(self.peer_hits.items()):
            if len(hits) >= 3 and ("browse", user) not in self.harvested and self.browses < 8:
                self.harvested.add(("browse", user))
                self.harvest_q.append(("browse", user, None))
        return gained

    def match_entries(self, entries, exclude=None):
        """Score new pool files against every track still looking for a copy."""
        idx = collections.defaultdict(list)
        for row in self.q("select * from tracks where status in ('search','searching','transfer','missing')"):
            req = self.req_of(row)
            if row["id"] != exclude and req.core_tokens:
                idx[max(req.core_tokens, key=len)].append((row, req))
        matches = []
        for e in entries:
            for tok in e["name_set"]:
                for row, req in idx.get(tok, ()):
                    if set(req.core_tokens) <= e["name_set"]:
                        t = self.target(row)
                        good, score, notes = evaluate(req, e, t["length"] if t else None, e["peer"])
                        if good:
                            matches.append((row, e, score, notes))
        return self.record_matches(matches)

    def match_track(self, row):
        req = self.req_of(row)
        if not req.core_tokens:
            return set()
        with self.pool_lock:
            entries = list(self.pool_index.get(max(req.core_tokens, key=len), ()))
        t = self.target(row)
        matches = []
        for e in entries:
            if set(req.core_tokens) <= e["name_set"]:
                good, score, notes = evaluate(req, e, t["length"] if t else None, e["peer"])
                if good:
                    matches.append((row, e, score, notes))
        return self.record_matches(matches)

    def harvester(self):
        """Folder listings and share browses: candidates without spending Soulseek searches."""
        while not self.stop.is_set():
            if not self.harvest_q:
                time.sleep(2)
                continue
            kind, user, d = self.harvest_q.popleft()
            try:
                dirs = self.slsk.directory(user, d) if kind == "dir" else self.slsk.browse(user)
            except Exception as e:
                self.log(f"harvest   {kind} {user} failed: {str(e)[:120]}")
                continue
            if kind == "browse":
                self.browses += 1
            peer = self.peer_info.get(user) or {"username": user, "hasFreeUploadSlot": None, "queueLength": None, "uploadSpeed": None}
            new = []
            if isinstance(dirs, dict):  # browse returns {"directories": [...], "lockedDirectories": [...]}
                dirs = dirs.get("directories") or [dirs]
            for dobj in dirs:
                new += self.pool_add(peer, dobj.get("files") or [], dobj.get("name"))
            gained = self.match_entries(new)
            if gained or kind == "browse":
                self.log(f"harvest   {kind} {user}: {len(new)} files, {len(gained)} tracks gained candidates")

    def place_rejected(self, src):
        dest = self.dir / "_rejected" / src.name
        shutil.move(str(src), dest)
        parent = src.parent
        while parent != self.incoming and parent.is_relative_to(self.incoming) and not any(parent.iterdir()):
            parent.rmdir()
            parent = parent.parent

    # ---- phase 1: resolve (Beatport + library check), in a thread
    def resolver(self):
        excl = [self.dir / "_rejected", self.dir / "_review", self.incoming]
        idx = None if self.args.no_have else build_have_index([*self.cfg["have_dirs"], *self.extra_have], excl)
        adopt = build_have_index(self.adopt_dirs, excl) if self.adopt_dirs else None
        while True:
            rows = self.q("select * from tracks where status='pending' order by pos limit 20")
            if not rows:
                return
            for row in rows:
                req = self.req_of(row)
                ignored = next((w for w in PREFS["versions"].get("ignore", []) if has_phrase(norm(row["title"]), w)), None)
                if ignored:
                    self.status(row["id"], "skipped", note=f"{ignored}: ignored by preferences")
                    self.log(f"skipped   {row['artist']} - {row['title']} ({ignored})")
                    continue
                try:
                    target = resolve_beatport(req, json.loads(row["row_json"]))
                except Exception as e:
                    target = None
                    self.log(f"beatport error for {row['artist']} - {row['title']}: {e}")
                tlen = target["length"] if target else None
                if adopt:
                    path, info = find_have(req, adopt, tlen)
                    if path:
                        adopt[:] = [e for e in adopt if e[2] != path]
                        row = self.q("select * from tracks where id=?", (row["id"],))[0]
                        self.q("update tracks set target_json=? where id=?", (json.dumps(target) if target else None, row["id"]))
                        row = self.q("select * from tracks where id=?", (row["id"],))[0]
                        dest = self.place(row, path)
                        self.status(row["id"], "done", final_path=str(dest), source="adopted",
                                    note=f"{info['codec']} {info['duration']:.0f}s, moved from {path.parent}" + (f", matches Beatport {target['mix_name']}" if target else ""))
                        self.log(f"adopted   {row['artist']} - {row['title']}")
                        continue
                if idx is not None:
                    path, info = find_have(req, idx, tlen)
                    if path:
                        self.status(row["id"], "have", target_json=json.dumps(target) if target else None,
                                    final_path=str(path), source="library", note=f"{info['duration']:.0f}s already in library")
                        self.log(f"have      {row['artist']} - {row['title']}")
                        continue
                if target:
                    nxt, note = "search", f"Beatport: {target['mix_name']} {target['length']:.0f}s"
                elif self.args.no_soundcloud:
                    nxt, note = "search", "not on Beatport"
                else:
                    nxt, note = "sc", "not on Beatport; SoundCloud first"
                self.status(row["id"], nxt, target_json=json.dumps(target) if target else None, note=note)
                self.log(f"resolved  {row['artist']} - {row['title']}: {note}")
                if nxt == "search" and self.match_track(self.q("select * from tracks where id=?", (row["id"],))[0]):
                    self.log(f"pooled    {row['artist']} - {row['title']}: copies already seen, no search needed")

    # ---- SoundCloud-only tracks (not on Beatport): SoundCloud is the source
    def sc_accept(self, row, path, note):
        info = probe(path)
        if not info or info["duration"] < 90:  # shorter than any DJ track: a preview clip
            return False
        dest = self.place(row, path)
        self.status(row["id"], "done", final_path=str(dest), source="soundcloud", sc_tried=1,
                    note=f"{note}; {info['codec']} {info['duration']:.0f}s")
        self.log(f"done      {row['artist']} - {row['title']} [soundcloud: {note}]")
        return True

    def sc_fallback(self, row, sc_state, why):
        """No SoundCloud download: one Soulseek attempt just in case, then give up."""
        self.status(row["id"], "search", sc_tried=1, sc_json=json.dumps(sc_state), note=why)

    def soundcloud_worker(self, resolver_thread):
        sc = SoundCloud(self.cfg)
        tmp = self.dir / ".incoming-sc"
        while not self.stop.is_set():
            rows = self.q("select * from tracks where status='sc' order by pos limit 1")
            if not rows:
                if not resolver_thread.is_alive() and not self.q("select 1 from tracks where status in ('pending','sc','gating','gating_active') limit 1"):
                    return
                time.sleep(3)
                continue
            row = rows[0]
            req = self.req_of(row)
            self.status(row["id"], "sc_active")
            try:
                cands = sc_candidates(sc, req, json.loads(row["row_json"]), None)
            except Exception as e:
                cands = []
                self.log(f"soundcloud error for {row['artist']} - {row['title']}: {e}")
            gates, done = [], False
            for c in cands:
                for kind, url, where in c["offers"]:
                    if kind == "gate":
                        if url not in [g["url"] for g in gates]:
                            gates.append({"url": url, "where": where, "sc": c["url"], "title": c["title"]})
                        continue
                    try:
                        path = sc.download(c["track"], tmp) if kind == "direct" else fetch_file_host(url, tmp)
                    except Exception as e:
                        path = None
                        self.log(f"soundcloud download failed ({url}): {str(e)[:120]}")
                    note = "download button" if kind == "direct" else f"{where} link to {urllib.parse.urlparse(url).hostname}"
                    if path and self.sc_accept(row, path, f"SoundCloud {note} on {c['url']}"):
                        done = True
                        break
                if done:
                    break
            if done:
                continue
            state = {"uploads": [{"url": c["url"], "title": c["title"], "offers": c["offers"]} for c in cands[:5]], "gates": gates[:6]}
            if gates:
                self.status(row["id"], "gating", sc_json=json.dumps(state))
                self.log(f"gate      {row['artist']} - {row['title']}: {len(gates)} gate(s) queued")
            else:
                why = "on SoundCloud without a free download" if cands else "no matching SoundCloud upload"
                self.sc_fallback(row, state, why)

    def gate_worker(self, resolver_thread):
        gb = None
        try:
            while not self.stop.is_set():
                with self.lock:
                    row = self.db.execute("select * from tracks where status='gating' order by pos limit 1").fetchone()
                    if row:
                        set_status(self.db, row["id"], "gating_active")
                if not row:
                    if not resolver_thread.is_alive() and not self.q("select 1 from tracks where status in ('pending','sc','sc_active','gating') limit 1"):
                        return
                    time.sleep(3)
                    continue
                state = json.loads(row["sc_json"])
                try:
                    gb = gb or GateBrowser(self.cfg)
                except Exception as e:
                    self.sc_fallback(row, state, f"browser for gates didn't start ({str(e)[:100]}); trying Soulseek")
                    continue
                failures = []
                for g in state["gates"]:
                    out = self.dir / ".incoming-sc" / row["id"]
                    try:
                        path, note = solve_gate(gb, g["url"], out, log=self.log, timeout=150, sc_url=g.get("sc"))
                    except Exception as e:
                        path, note = None, f"error: {str(e)[:120]}"
                    if path and self.sc_accept(row, path, f"SoundCloud gate {urllib.parse.urlparse(g['url']).hostname} ({g['sc']})"):
                        shutil.rmtree(out, ignore_errors=True)
                        break
                    failures.append(f"{g['url']}: {note}")
                    self.log(f"gate fail {row['artist']} - {row['title']}: {g['url']} ({note})")
                else:
                    state["gate_failures"] = failures
                    self.sc_fallback(row, state, "gate(s) not solved; trying Soulseek")
        finally:
            if gb:
                gb.close()

    # ---- Soulseek main loop
    def finish_unfound(self, row, why):
        req = self.req_of(row)
        sc = json.loads(row["sc_json"]) if row["sc_json"] else {}
        review = self.q("select final_path from tracks where id=?", (row["id"],))[0]["final_path"]
        if review and Path(review).exists():
            self.status(row["id"], "review", note=f"closest copy kept in _review ({why})")
        elif sc.get("gate_failures"):
            self.status(row["id"], "gate", note="SoundCloud gate not solved: " + " | ".join(sc["gate_failures"])[:400])
        elif sc.get("uploads") is not None and not self.target(row):
            self.status(row["id"], "missing", note=(row["note"] or "no free download on SoundCloud") + "; not on Soulseek either")
            self.log(f"missing   {row['artist']} - {row['title']}: {row['note']}")
        else:
            self.status(row["id"], "missing", note=why)
            self.log(f"missing   {row['artist']} - {row['title']}: {why}")

    def handle_results(self, row, query, sid):
        req, target = self.req_of(row), self.target(row)
        tlen = target["length"] if target else None
        responses = self.slsk.responses(sid)
        self.slsk.delete_search(sid)
        files = ok = 0
        new = []
        with self.lock:
            for resp in responses:
                peer = {k: resp.get(k) for k in ("username", "hasFreeUploadSlot", "queueLength", "uploadSpeed")}
                self.peer_info[resp["username"]] = peer
                for f in resp.get("files") or []:
                    files += 1
                    good, score, notes = evaluate(req, f, tlen, peer)
                    ok += good
                    self.db.execute("insert or replace into candidates values (?,?,?,?,?,?,?,?,?,?,?)",
                                    (row["id"], resp["username"], f["filename"], f.get("size"), f.get("length"), f.get("bitRate"),
                                     (f.get("extension") or f["filename"].rpartition(".")[2]).lower(), int(good), score,
                                     "; ".join(notes), json.dumps(peer)))
            self.db.execute("insert into searches values (?,?,?,?,?,?)", (row["id"], query, sid, files, ok, time.time()))
            self.db.commit()
        for resp in responses:
            new += self.pool_add(self.peer_info[resp["username"]], resp.get("files") or [])
        gained = self.match_entries(new, exclude=row["id"])
        self.empty_streak = 0 if files else getattr(self, "empty_streak", 0) + 1
        self.log(f"searched  {row['artist']} - {row['title']} [{query}]: {files} files, {ok} usable"
                 + (f"; {len(gained)} other tracks gained candidates" if gained else ""))
        self.status(row["id"], "transfer" if self.next_candidate(row["id"]) else "search", qidx=row["qidx"] + 1)

    def next_candidate(self, tid, exclude_peers=()):
        attempts = self.q("select username, filename, detail from attempts where track=?", (tid,))
        tried = {(r["username"], r["filename"]) for r in attempts}
        # A peer that timed out, refused us or queued too long is done for this track. "Reported as failed by
        # remote client" is about one broken file; the same peer's other copies are still worth a try.
        peers_tried = {r["username"] for r in attempts if not re.search(r"reported as failed by remote|rejected: \d+s vs|vs target", r["detail"] or "", re.I)}
        if len({r["username"] for r in attempts}) >= self.prefs["max_peers_per_track"] or len(attempts) >= 3 * self.prefs["max_peers_per_track"]:
            return None
        row = self.q("select * from tracks where id=?", (tid,))[0]
        req, target = self.req_of(row), self.target(row)
        for c in self.q("select * from candidates where track=? and ok=1 order by score desc", (tid,)):
            if (c["username"], c["filename"]) in tried or c["username"] in peers_tried or c["username"] in exclude_peers:
                continue
            f = {"filename": c["filename"], "size": c["size"], "length": c["length"], "bitRate": c["bitrate"], "extension": c["ext"]}
            if c["notes"] != "picked by hand" and not evaluate(req, f, target["length"] if target else None)[0]:
                continue
            if self.bad_peers.get(c["username"], 0) >= 3:
                continue
            return c
        return None

    def start_transfer(self, row, active):
        """Start one more download for this track. Returns False when there is nothing left to try."""
        racing = {k[1] for k in active if k[0] == row["id"]}
        c = self.next_candidate(row["id"], exclude_peers=racing)
        if not c:
            if racing:
                return False  # wait for the downloads already racing
            req = self.req_of(row)
            if row["qidx"] < len(req.queries()):
                self.status(row["id"], "search")
            else:
                self.finish_unfound(row, "no usable copy transferred")
            return False
        if racing and not self.target(row) and c["length"]:
            # With no Beatport length to check against, the longest copy is the best guess at the extended
            # version, so a shorter one must not race it and win just by finishing first.
            lens = [r["length"] for k in active if k[0] == row["id"]
                    for r in self.q("select length from candidates where track=? and username=? and filename=?", k)]
            longest = max([n for n in lens if n] or [0])
            if c["length"] < longest - PREFS["versions"]["length_tolerance_seconds"]:
                return False
        try:
            tid = self.slsk.enqueue(c["username"], c["filename"], c["size"])
            state, detail = "active", None
        except Exception as e:
            tid, state, detail = None, "failed", str(e)
            self.bad_peers[c["username"]] = self.bad_peers.get(c["username"], 0) + 1
        self.q("insert or replace into attempts values (?,?,?,?,?,?,?,?)",
               (row["id"], c["username"], c["filename"], tid, state, time.time(), None if tid else time.time(), detail))
        if tid:
            active[(row["id"], c["username"], c["filename"])] = {"track": row["id"], "username": c["username"], "filename": c["filename"],
                                                                "id": tid, "started": time.time(), "since": time.time(), "bytes": -1, "moved": time.time()}
            self.log(f"transfer  {row['artist']} - {row['title']} <- {c['username']}: {file_basename(c['filename'])}")
        return True

    def locate_download(self, filename, started):
        base = file_basename(filename)
        parent = re.split(r"[\\/]", filename)[-2] if re.search(r"[\\/]", filename) else ""
        hits = [Path(r) / fn for r, _, fs in os.walk(self.incoming) for fn in fs if fn == base]
        hits = [p for p in hits if p.stat().st_mtime >= started - 5]
        hits.sort(key=lambda p: (p.parent.name != parent, -p.stat().st_mtime))
        return hits[0] if hits else None

    def finish_transfer(self, row, a, state, detail=None):
        self.q("update attempts set state=?, ended=?, detail=? where track=? and username=? and filename=?",
               (state, time.time(), detail, row["id"], a["username"], a["filename"]))

    def poll_transfers(self, active):
        by_user = {}
        for key, a in list(active.items()):
            if key not in active:
                continue  # cancelled because another peer won the race
            row = self.q("select * from tracks where id=?", (a["track"],))[0]
            if a["username"] not in by_user:
                try:
                    by_user[a["username"]] = self.slsk.downloads(a["username"])
                except Exception as e:
                    self.log(f"slskd poll error: {e}")
                    continue
            t = by_user[a["username"]].get(a["id"])
            now = time.time()
            if t is None:
                if now - a["started"] > 60:
                    self.finish_transfer(row, a, "failed", "transfer disappeared")
                    del active[key]
                continue
            state = t.get("state", "")
            got = t.get("bytesTransferred") or 0
            if got != a["bytes"]:
                a["bytes"], a["moved"] = got, now
            if "Succeeded" in state:
                getattr(self, "outcomes", collections.deque()).append("ok")
                del active[key]
                if self.verify(row, a):
                    for other, b in list(active.items()):  # this peer won the race: stop the others
                        if b["track"] == a["track"]:
                            self.slsk.cancel(b["username"], b["id"])
                            self.finish_transfer(row, b, "cancelled", "another peer finished first")
                            del active[other]
            elif "Completed" in state:
                reason = state.replace("Completed, ", "") + (f": {t.get('exception')}" if t.get("exception") else "")
                getattr(self, "outcomes", collections.deque()).append("conn" if re.search(r"TimedOut|reported as failed by remote", reason) else "other")
                self.bad_peers[a["username"]] = self.bad_peers.get(a["username"], 0) + 1
                self.finish_transfer(row, a, "failed", reason)
                self.log(f"failed    {row['artist']} - {row['title']} <- {a['username']}: {reason}")
                del active[key]
            else:
                limit = None
                if "Queued" in state and now - a["started"] > self.prefs["remote_queue_timeout_minutes"] * 60:
                    limit = "remote queue too slow"
                elif "InProgress" in state and now - a["moved"] > self.prefs["stalled_timeout_minutes"] * 60:
                    limit = "transfer stalled"
                elif ("Requested" in state or "Initializing" in state) and now - a["started"] > 180:
                    limit = "peer never answered"
                if limit:
                    self.slsk.cancel(a["username"], a["id"])
                    self.finish_transfer(row, a, "failed", limit)
                    self.log(f"gave up   {row['artist']} - {row['title']} <- {a['username']}: {limit}")
                    del active[key]

    def verify(self, row, a):
        """Check a finished download. Returns True when the track is now done."""
        row = self.q("select * from tracks where id=?", (row["id"],))[0]
        src = self.locate_download(a["filename"], a["since"])
        if row["status"] == "done":
            if src:
                src.unlink(missing_ok=True)
            self.finish_transfer(row, a, "cancelled", "another peer finished first")
            return True
        info = probe(src) if src else None
        if not info:
            self.finish_transfer(row, a, "failed", "downloaded file missing or unreadable")
            if src:
                self.place_rejected(src)
            return False
        target = self.target(row)
        sim, why = None, None
        if target:
            try:
                sim = beatport_preview_match(target, src)
            except Exception:
                sim = None
            if sim is not None and sim < PREFS["versions"].get("min_fingerprint_similarity", 0.7):
                why = f"audio doesn't match the Beatport preview ({sim:.2f})"
        if sim is None and not why:
            try:
                sim, why = store_preview_check(self.req_of(row), src, PREFS["versions"].get("min_fingerprint_similarity", 0.7))
            except Exception:
                sim, why = None, None
        if sim is None and not why:
            why = tag_mismatch(self.req_of(row), src)  # nothing to listen to: fall back on the file's tags
        if why:
            self.place_rejected(src)
            self.finish_transfer(row, a, "rejected", why)
            self.log(f"rejected  {row['artist']} - {row['title']}: {why}")
            return False
        d = abs(info["duration"] - target["length"]) if target else 0
        pv = PREFS["versions"]
        if d <= pv["length_tolerance_seconds"]:
            old = row["final_path"]
            if old and Path(old).exists() and "/_review/" in old:
                shutil.move(old, self.dir / "_rejected" / Path(old).name)
            dest = self.place(row, src)
            note = (f"{info['codec']} {info['duration']:.0f}s" + (f", matches Beatport {target['mix_name']}" if target else ", no Beatport release to compare")
                    + (f", audio matches preview {sim:.2f}" if sim is not None else ""))
            self.finish_transfer(row, a, "succeeded", str(dest))
            folder = re.split(r"[\\/][^\\/]*$", a["filename"])[0]
            if ("dir", a["username"], folder) not in self.harvested:
                self.harvested.add(("dir", a["username"], folder))
                self.harvest_q.append(("dir", a["username"], folder))
            self.status(row["id"], "done", final_path=str(dest), source=f"soulseek:{a['username']}", note=note)
            self.log(f"done      {row['artist']} - {row['title']} ({note})")
            return True
        elif d <= pv["review_tolerance_seconds"] and not row["final_path"]:
            dest = self.place(row, src, "_review")
            self.finish_transfer(row, a, "review", f"off by {d:.0f}s")
            self.q("update tracks set final_path=? where id=?", (str(dest), row["id"]))
            self.log(f"review    {row['artist']} - {row['title']}: off by {d:.0f}s, still looking")
        else:
            self.place_rejected(src)
            self.finish_transfer(row, a, "rejected", f"{info['duration']:.0f}s vs target {target['length']:.0f}s")
            self.log(f"rejected  {row['artist']} - {row['title']}: {info['duration']:.0f}s vs {target['length']:.0f}s")

    def run(self):
        ok, msg = port_check()
        self.log(f"network   {msg}")
        if not ok:
            sys.exit(f"Stopping: {msg}")
        self.last_port_renew = time.time()
        self.outcomes = collections.deque(maxlen=12)
        srv = self.slsk.server()
        if not srv or not srv.get("isLoggedIn"):
            sys.exit(f"slskd isn't logged in to Soulseek ({srv}). Check `launchctl print gui/$UID/com.aaronpak.slskd`.")
        self.extra_have = [Path(p).expanduser() for p in self.args.have or []]
        self.adopt_dirs = [Path(p).expanduser() for p in getattr(self.args, "adopt", None) or []]
        self.q("update tracks set status='search' where status='searching'")
        self.q("update tracks set status='sc' where status='sc_active'")
        self.q("update tracks set status='gating' where status='gating_active'")
        if self.args.no_soundcloud:  # no SoundCloud workers this run, so queued SoundCloud work goes to Soulseek
            self.q("update tracks set status='search' where status in ('sc','gating')")
        active = {}
        for r in self.q("select * from attempts where state='active'"):
            active[(r["track"], r["username"], r["filename"])] = {"track": r["track"], "username": r["username"], "filename": r["filename"], "id": r["transfer_id"],
                                  "started": r["started"], "since": r["started"], "bytes": -1, "moved": time.time()}
        resolver = threading.Thread(target=self.resolver, daemon=True)
        resolver.start()
        sc_thread = None
        if not self.args.no_soundcloud:
            sc_thread = threading.Thread(target=self.soundcloud_worker, args=(resolver,), daemon=True)
            sc_thread.start()
            self.gate_threads = [threading.Thread(target=self.gate_worker, args=(resolver,), daemon=True)
                                 for _ in range(PREFS.get("soundcloud", {}).get("gate_workers", 2))]
            for t in self.gate_threads:
                t.start()
        pace, inflight = Pace(), {}
        threading.Thread(target=self.harvester, daemon=True).start()
        last_report = 0
        down_since = None
        # Keep the Mac awake while the run lasts (closing the lid on battery still sleeps it).
        subprocess.Popen(["caffeinate", "-i", "-s", "-w", str(os.getpid())], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        # time.time() keeps counting through sleep and time.monotonic() doesn't, so a jump in their gap means we slept.
        clock_gap = time.time() - time.monotonic()
        while True:
            slept = (time.time() - time.monotonic()) - clock_gap
            if slept > 30:
                clock_gap += slept
                self.after_sleep(slept, inflight, active)
                continue
            try:
                self.step(pace, inflight, active)
                down_since = None
            except SlskdUnavailable as e:
                down_since = down_since or time.time()
                if time.time() - down_since > 90:
                    self.log("slskd hasn't answered for 90s; restarting it")
                    subprocess.run(["launchctl", "kickstart", "-k", f"gui/{os.getuid()}/com.aaronpak.slskd"], check=False)
                    down_since = time.time()
                else:
                    self.log(f"slskd unavailable, retrying in 15s: {e}")
                time.sleep(15)
                continue
            if time.time() - self.last_port_renew > 1800:
                threading.Thread(target=port_check, daemon=True).start()
                self.last_port_renew = time.time()
            if getattr(self, "empty_streak", 0) >= PREFS["soulseek"].get("empty_search_streak_limit", 12):
                self.log("stopping: the last searches all came back empty, so the network or the Soulseek server "
                         "isn't answering. Rerun later; nothing is lost.")
                break
            if len(self.outcomes) == self.outcomes.maxlen and sum(o == "conn" for o in self.outcomes) >= 10:
                self.outcomes.clear()
                ok, msg = port_check(renew=False)
                self.log(f"warning   most recent transfers failed to connect; {msg}")
                if not ok:
                    self.log(f"stopping: {msg}")
                    break
            if time.time() - last_report > 60:
                write_report(self.db, self.dir)
                last_report = time.time()
            busy = self.q("select count(*) from tracks where status in ('pending','sc','sc_active','gating','gating_active','search','searching','transfer')")[0][0]
            if not busy and not active and not inflight and not self.harvest_q and not resolver.is_alive() and not (sc_thread and sc_thread.is_alive()) and not any(t.is_alive() for t in getattr(self, "gate_threads", [])):
                break
            if self.args.limit_minutes and time.time() - self.t0 > self.args.limit_minutes * 60:
                self.log("time limit reached; rerun the same command to resume")
                break
            time.sleep(2)
        self.stop.set()
        write_report(self.db, self.dir)
        self.log(f"finished. report: {self.dir / 'report.md'}")

    def after_sleep(self, slept, inflight, active):
        """The Mac was asleep: nothing that happened meanwhile says anything about the tracks.

        Searches in flight lost their answers, so they're asked again; transfer timers skip the gap; and the
        run waits for slskd to log back in before it searches or judges peers again."""
        self.log(f"asleep    the Mac slept for {slept / 60:.0f} min; redoing {len(inflight)} searches and waiting for slskd")
        for sid, (tid, _, _) in list(inflight.items()):
            try:
                self.slsk.delete_search(sid)
            except SlskdUnavailable:
                pass
            self.q("update tracks set status='search' where id=? and status='searching'", (tid,))
        inflight.clear()
        for a in active.values():
            a["started"] += slept
            a["moved"] += slept
        self.t0 += slept
        self.empty_streak = 0
        self.outcomes.clear()
        if slept > 300:
            # After a long sleep slskd can claim to be logged in while its peer connections are dead (searches
            # come back empty), so restart it.
            subprocess.run(["launchctl", "kickstart", "-k", f"gui/{os.getuid()}/com.aaronpak.slskd"], check=False)
            time.sleep(20)
        end = time.time() + 600
        while time.time() < end:
            try:
                if (self.slsk.server() or {}).get("isLoggedIn"):
                    time.sleep(10)  # let the server connection and peer listener settle
                    return
            except SlskdUnavailable:
                pass
            time.sleep(5)
        self.log("slskd still isn't logged in 10 min after waking; continuing anyway")

    def step(self, pace, inflight, active):
        # searches: finish completed ones, start new ones within the pacing budget
        for sid, (tid, query, t0) in list(inflight.items()):
            st = self.slsk.search_state(sid) or {}
            if st.get("isComplete") or "Completed" in (st.get("state") or "") or time.time() - t0 > 90:
                del inflight[sid]
                self.handle_results(self.q("select * from tracks where id=?", (tid,))[0], query, sid)
        while len(inflight) < self.prefs["max_inflight_searches"]:
            rows = self.q("select * from tracks where status='search' order by pos limit 1")
            if not rows:
                break
            row = rows[0]
            if self.next_candidate(row["id"]):
                self.status(row["id"], "transfer")
                continue
            queries = self.req_of(row).queries()
            if row["qidx"] >= len(queries):
                if self.q("select 1 from candidates where track=? and ok=1 limit 1", (row["id"],)) and self.next_candidate(row["id"]):
                    self.status(row["id"], "transfer")
                else:
                    self.finish_unfound(row, f"no usable copy in {len(queries)} searches")
                continue
            if not pace.take():
                break
            query = queries[row["qidx"]]
            try:
                sid = self.slsk.start_search(query)
            except Exception as e:
                self.log(f"search error: {e}")
                break
            inflight[sid] = (row["id"], query, time.time())
            self.status(row["id"], "searching")
        # transfers
        self.poll_transfers(active)
        # Race up to race_peers downloads per track; the first good copy wins and the rest are cancelled.
        for row in self.q("select * from tracks where status='transfer' order by pos"):
            while len(active) < self.prefs["max_active_transfers"] and \
                    sum(1 for k in active if k[0] == row["id"]) < self.prefs.get("race_peers", 3):
                if not self.start_transfer(row, active):
                    break


# ---------------------------------------------------------------- reporting

def write_report(db, list_dir):
    rows = db.execute("select * from tracks order by pos").fetchall()
    counts = {}
    for r in rows:
        counts[r["status"]] = counts.get(r["status"], 0) + 1
    lines = [f"# {list_dir.name}", "", f"Updated {time.strftime('%Y-%m-%d %H:%M')}. " +
             ", ".join(f"**{counts.get(s, 0)}** {s}" for s in ("done", "have", "review", "gate", "missing") if counts.get(s)) +
             (f", {sum(counts.get(s, 0) for s in ACTIVE)} still in progress" if any(counts.get(s) for s in ACTIVE) else ""), ""]
    sections = [("review", "Needs a listen (in _review/)"), ("gate", "Free downloads behind a gate"),
                ("missing", "Not found"), ("done", "Downloaded"), ("have", "Already in your library"), ("skipped", "Skipped")]
    for status, heading in sections:
        sel = [r for r in rows if r["status"] == status]
        if not sel:
            continue
        lines += [f"## {heading} ({len(sel)})", ""]
        for r in sel:
            t = json.loads(r["target_json"]) if r["target_json"] else None
            tgt = f" · target {t['mix_name']} {t['length'] // 60:.0f}:{t['length'] % 60:02.0f}" if t else ""
            path = f" · `{Path(r['final_path']).name}`" if r["final_path"] and status in ("done", "review", "have") else ""
            lines.append(f"- {r['artist']} – {r['title']}{tgt}{path} — {r['note'] or ''}")
        lines.append("")
    tmp = list_dir / "report.md.tmp"
    tmp.write_text("\n".join(lines))
    os.replace(tmp, list_dir / "report.md")
    with (list_dir / "_state/report.csv").open("w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["artist", "title", "status", "source", "target_mix", "target_length", "path", "note"])
        for r in rows:
            t = json.loads(r["target_json"]) if r["target_json"] else {}
            w.writerow([r["artist"], r["title"], r["status"], r["source"], t.get("mix_name"), t.get("length"), r["final_path"], r["note"]])


# ---------------------------------------------------------------- commands

def cmd_run(args):
    cfg = load_config()
    runner = Runner(cfg, args.list, args)
    rows = []
    for inp in args.input or []:
        rows += read_rows(inp)
    for t in args.track or []:
        if " - " not in t:
            sys.exit(f"--track needs 'Artist - Title': {t}")
        a, ti = t.split(" - ", 1)
        rows.append({"artist": a, "title": ti})
    if args.limit:
        rows = rows[:args.limit]
    added = add_tracks(runner.db, rows)
    if args.retry:
        n = runner.db.execute("update tracks set status='pending', qidx=0, sc_tried=0 where status in ('missing','gate','review')").rowcount
        runner.db.commit()
        runner.log(f"retrying {n} unfinished tracks")
    runner.log(f"{added} tracks added; list folder {runner.dir}")
    runner.t0 = time.time()
    runner.run()


def open_list(name):
    cfg = load_config()
    d = cfg["library_root"] / safe_name(name)
    if not (d / "_state/state.sqlite").exists():
        sys.exit(f"No list named {name!r} in {cfg['library_root']}")
    return d, open_db(d)


def cmd_status(args):
    d, db = open_list(args.list)
    for s, n in db.execute("select status, count(*) from tracks group by status order by 2 desc"):
        print(f"{s:10} {n}")
    act = db.execute("select t.artist, t.title, a.username from attempts a join tracks t on t.id=a.track where a.state='active'").fetchall()
    for r in act:
        print(f"  downloading {r['artist']} - {r['title']} <- {r['username']}")
    write_report(db, d)
    print(f"report: {d / 'report.md'}")


def find_track(db, needle):
    rows = db.execute("select * from tracks where id=? or lower(artist || ' - ' || title) like ?", (needle, f"%{needle.lower()}%")).fetchall()
    if not rows:
        sys.exit(f"no track matches {needle!r}")
    if len(rows) > 1:
        for r in rows[:20]:
            print(f"{r['id']}  {r['artist']} - {r['title']}  [{r['status']}]")
        sys.exit("several tracks match; pass the id")
    return rows[0]


def cmd_candidates(args):
    d, db = open_list(args.list)
    row = find_track(db, args.track)
    print(f"{row['artist']} - {row['title']}  [{row['status']}] {row['note'] or ''}")
    if row["target_json"]:
        t = json.loads(row["target_json"])
        print(f"target: {t['mix_name']} {t['length']:.0f}s  {t.get('url', '')}  others: {t.get('other_versions')}")
    for s in db.execute("select query, files, ok from searches where track=?", (row["id"],)):
        print(f"search [{s['query']}]: {s['files']} files, {s['ok']} usable")
    sql = "select * from candidates where track=? " + ("" if args.all else "and ok=1 ") + "order by ok desc, score desc limit ?"
    for c in db.execute(sql, (row["id"], args.n)):
        a = db.execute("select state, detail from attempts where track=? and username=? and filename=?", (row["id"], c["username"], c["filename"])).fetchone()
        tried = f"  [{a['state']}: {a['detail'] or ''}]" if a else ""
        print(f"{'OK ' if c['ok'] else 'NO '}{c['score']:7.1f} {c['length'] or '?':>4}s {c['ext']:4} {c['bitrate'] or '':>4} "
              f"{c['username']}: {c['filename']}  {c['notes'] or ''}{tried}")


def cmd_pick(args):
    """Download one specific file for a track, bypassing the ranking, and verify it like any other."""
    cfg = load_config()
    runner = Runner(cfg, args.list, argparse.Namespace(no_have=True, no_soundcloud=True, have=[], adopt=[], limit_minutes=0))
    row = find_track(runner.db, args.track)
    c = runner.db.execute("select size from candidates where track=? and username=? and filename=?", (row["id"], args.peer, args.file)).fetchone()
    size = (c["size"] if c else None) or args.size
    if not size:
        sys.exit("unknown file size; pass --size")
    if row["status"] == "done" and not args.replace:
        sys.exit(f"already done ({row['final_path']}); pass --replace to fetch this copy anyway")
    tid = runner.slsk.enqueue(args.peer, args.file, size)
    runner.q("insert or replace into attempts values (?,?,?,?,?,?,?,?)", (row["id"], args.peer, args.file, tid, "active", time.time(), None, "picked by hand"))
    runner.status(row["id"], "transfer", final_path=None if args.replace else row["final_path"])
    active = {(row["id"], args.peer, args.file): {"track": row["id"], "username": args.peer, "filename": args.file, "id": tid,
                                                  "started": time.time(), "since": time.time(), "bytes": -1, "moved": time.time()}}
    runner.log(f"transfer  {row['artist']} - {row['title']} <- {args.peer}: {file_basename(args.file)}")
    while active:
        time.sleep(3)
        runner.poll_transfers(active)
    row = runner.q("select * from tracks where id=?", (row["id"],))[0]
    if row["status"] == "transfer":
        runner.status(row["id"], "review" if row["final_path"] else "missing", note="hand-picked copy failed; see candidates")
    write_report(runner.db, runner.dir)
    a = runner.q("select state, detail from attempts where track=? and username=? and filename=?", (row["id"], args.peer, args.file))[0]
    print(f"{a['state']}: {a['detail']}")


def cmd_search(args):
    """Raw Soulseek search, paced like everything else. Prints every file as JSON lines."""
    cfg = load_config()
    slsk, pace = Slskd(cfg["slskd"]["url"], cfg["slskd"]["api_key"]), Pace()
    while not pace.take():
        time.sleep(5)
    sid = slsk.start_search(args.text)
    t0 = time.time()
    while time.time() - t0 < 90:
        st = slsk.search_state(sid) or {}
        if st.get("isComplete") or "Completed" in (st.get("state") or ""):
            break
        time.sleep(2)
    req = Request(args.artist, args.title) if args.artist and args.title else None
    for resp in slsk.responses(sid):
        peer = {k: resp.get(k) for k in ("username", "hasFreeUploadSlot", "queueLength", "uploadSpeed")}
        for f in resp.get("files") or []:
            rec = {**peer, **{k: f.get(k) for k in ("filename", "size", "length", "bitRate", "extension")}}
            if req:
                rec["ok"], rec["score"], rec["notes"] = evaluate(req, f, args.length, peer)
            print(json.dumps(rec))
    slsk.delete_search(sid)


def cmd_gate(args):
    gb = GateBrowser(load_config(), headless=not args.show)
    try:
        path, note = solve_gate(gb, args.url, Path(args.out).expanduser(), sc_url=args.sc)
    finally:
        gb.close()
    print(f"{path or 'FAILED'}  ({note})")
    sys.exit(0 if path else 1)


def cmd_doctor(args):
    cfg = load_config()
    ok = True
    try:
        srv = Slskd(cfg["slskd"]["url"], cfg["slskd"]["api_key"]).server()
        print(f"slskd: {'logged in' if srv and srv.get('isLoggedIn') else 'NOT logged in'} ({(srv or {}).get('state')})")
        ok &= bool(srv and srv.get("isLoggedIn"))
    except Exception as e:
        print(f"slskd: unreachable ({e})")
        ok = False
    print(f"ffprobe: {shutil.which('ffprobe') or 'MISSING'}")
    print(f"fpcalc: {shutil.which('fpcalc') or 'MISSING (brew install chromaprint); downloads are checked by tags only'}")
    try:
        r = resolve_beatport(Request("John Summit", "Where You Are"))
        print(f"beatport: ok ({r['mix_name']} {r['length']:.0f}s)" if r else "beatport: reachable, no match for the test track")
    except Exception as e:
        print(f"beatport: FAILED ({e})")
        ok = False
    prof = cfg.get("soundcloud", {}).get("profile")
    cookies = Path(prof or "/nonexistent") / "cookies.sqlite"
    print(f"soundcloud cookies: {cookies if cookies.exists() else 'MISSING (free downloads that need sign-in will fail)'}")
    print(f"library: {cfg['library_root']}")
    sys.exit(0 if ok else 1)


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = p.add_subparsers(dest="cmd", required=True)
    r = sub.add_parser("run", help="add tracks to a list and fetch everything not yet finished")
    r.add_argument("list", help="list name; becomes the folder under library_root")
    r.add_argument("--input", action="append", help="CSV with artist,title (+ optional soundcloud, beatport) or 'Artist - Title' lines")
    r.add_argument("--track", action="append", help="'Artist - Title'; repeatable")
    r.add_argument("--limit", type=int, help="only add the first N rows")
    r.add_argument("--retry", action="store_true", help="retry tracks that ended missing, gated or in review")
    r.add_argument("--have", action="append", help="extra folder of tracks already owned; repeatable")
    r.add_argument("--adopt", action="append", help="folder of earlier downloads: files matching a track (right name and length) are moved into the list; repeatable")
    r.add_argument("--no-have", action="store_true", help="don't skip tracks found in library folders")
    r.add_argument("--no-soundcloud", action="store_true")
    r.add_argument("--limit-minutes", type=float, default=0, help="stop after this long; rerun to resume")
    r.set_defaults(fn=cmd_run)
    s = sub.add_parser("status", help="counts and active transfers; refreshes report.md")
    s.add_argument("list")
    s.set_defaults(fn=cmd_status)
    c = sub.add_parser("candidates", help="every file Soulseek returned for a track, with verdicts")
    c.add_argument("list")
    c.add_argument("track", help="track id or part of 'Artist - Title'")
    c.add_argument("--all", action="store_true", help="include rejected files and why")
    c.add_argument("-n", type=int, default=40)
    c.set_defaults(fn=cmd_candidates)
    k = sub.add_parser("pick", help="download a specific peer's file for a track")
    k.add_argument("list")
    k.add_argument("track")
    k.add_argument("--peer", required=True)
    k.add_argument("--file", required=True)
    k.add_argument("--size", type=int)
    k.add_argument("--replace", action="store_true", help="fetch even if the track is already done")
    k.set_defaults(fn=cmd_pick)
    q = sub.add_parser("search", help="raw paced Soulseek search, JSON lines")
    q.add_argument("text")
    q.add_argument("--artist")
    q.add_argument("--title")
    q.add_argument("--length", type=float, help="target length in seconds for --artist/--title scoring")
    q.set_defaults(fn=cmd_search)
    gt = sub.add_parser("gate", help="solve one free-download gate (Hypeddit, ToneDen...) and save the file")
    gt.add_argument("url")
    gt.add_argument("--out", default=".")
    gt.add_argument("--show", action="store_true", help="run the browser visibly")
    gt.add_argument("--sc", help="the SoundCloud track the gate belongs to (for gates that verify a like/repost)")
    gt.set_defaults(fn=cmd_gate)
    sub.add_parser("doctor", help="check slskd, ffprobe, Beatport and SoundCloud cookies").set_defaults(fn=cmd_doctor)
    args = p.parse_args()
    args.fn(args)


if __name__ == "__main__":
    main()
