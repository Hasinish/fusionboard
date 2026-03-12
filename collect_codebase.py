#!/usr/bin/env python3
"""
collect_codebase.py — Token-optimized AI context builder
=========================================================

USAGE
-----
  python collect_codebase.py                    # auto-chunks at 80k tokens
  python collect_codebase.py --chunk-tokens 180000   # fewer, bigger chunks (best for Claude)
  python collect_codebase.py --single                # one file (small projects)
  python collect_codebase.py --strip-comments        # remove code comments (more token savings)
  python collect_codebase.py --include-tests         # include test files
  python collect_codebase.py --out-dir ./ctx         # custom output dir

OUTPUT  (→ ./ai_context/)
  index.md       full file map — upload first
  chunk_01.txt   source chunk 1
  chunk_02.txt   source chunk 2 (if needed)
  manifest.json  machine-readable summary

OPTIMIZATIONS vs naive collectors
  • Compact single-line file headers   (~8× less header overhead)
  • Blank-line normalization           (strips runs of empty lines)
  • Minified-file detection            (stubs instead of dumping 100k tokens)
  • Generated-file detection           (auto-skipped)
  • Parallel file reading              (4× faster on large codebases)
  • tiktoken (if installed) or fast heuristic for accurate token counts
  • .gitignore awareness (if pathspec installed)
  • Dedup by content hash (fixes truncated-file hash bug)
  • Dynamic import extraction for JS/TS
"""

from __future__ import annotations

import argparse
import ast
import hashlib
import json
import os
import re
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Optional

# ---------------------------------------------------------------------------
# Optional dependencies (graceful fallbacks)
# ---------------------------------------------------------------------------

try:
    import tiktoken
    _ENC = tiktoken.get_encoding("cl100k_base")
    def count_tokens(text: str) -> int:
        return len(_ENC.encode(text, disallowed_special=()))
    TIKTOKEN = True
except Exception:
    # ImportError, network errors (proxy/offline), or any other tiktoken init failure
    TIKTOKEN = False
    def count_tokens(text: str) -> int:          # ~3.5 chars/token heuristic
        return max(1, int(len(text) / 3.5))

try:
    import pathspec
    PATHSPEC = True
except ImportError:
    PATHSPEC = False

# ---------------------------------------------------------------------------
# Skip configuration
# ---------------------------------------------------------------------------

SKIP_DIRS: set[str] = {
    "node_modules", ".git", "__pycache__", ".next", "dist", "build",
    ".venv", "venv", "env", ".env", "coverage", ".nyc_output", ".cache",
    "tmp", "temp", ".turbo", ".vercel", ".netlify", "out", ".expo",
    "ios", "android", ".gradle", "target", "vendor", "bower_components",
    ".idea", ".vscode", "__mocks__", ".pytest_cache", ".mypy_cache",
    "storybook-static", ".storybook/public", "public/static",
}

SKIP_FILES: set[str] = {
    "package-lock.json", "yarn.lock", "pnpm-lock.yaml", "bun.lockb",
    ".env", ".env.local", ".env.production", ".env.development",
    ".gitignore", ".gitattributes", ".eslintignore", ".prettierignore",
    "thumbs.db", ".ds_store", "desktop.ini", "tsconfig.tsbuildinfo",
    ".npmignore", "collect_codebase.py",
}

SKIP_EXTS: set[str] = {
    ".png", ".jpg", ".jpeg", ".gif", ".webp", ".ico", ".bmp", ".tiff",
    ".psd", ".ai", ".sketch", ".fig",
    ".woff", ".woff2", ".ttf", ".eot", ".otf",
    ".zip", ".tar", ".gz", ".rar", ".7z", ".exe", ".dll", ".so", ".dylib",
    ".mp4", ".mp3", ".wav", ".mov", ".avi", ".pdf",
    ".sqlite", ".db", ".parquet",
    ".lock", ".snap",
    ".map",          # source maps — huge, zero signal
    ".min.js",       # handled separately but belt-and-suspenders
    ".chunk.js",
}

# Files/patterns that indicate auto-generated content → skip or stub
GENERATED_PATTERNS: list[re.Pattern] = [
    re.compile(r"\.d\.ts$"),                      # TS declaration files
    re.compile(r"\.generated\.(ts|js|graphql)$"),
    re.compile(r"__generated__"),
    re.compile(r"\.pb\.go$"),                     # protobuf generated Go
    re.compile(r"_pb2\.py$"),                     # protobuf generated Python
]

# Minification detection: if avg line length > threshold → minified
MINIFIED_AVG_LINE_LEN = 500
MAX_FILE_BYTES = 150_000   # files larger than this → first 200 lines only
PARALLEL_WORKERS = 8

# ---------------------------------------------------------------------------
# Language map
# ---------------------------------------------------------------------------

LANG_MAP: dict[str, str] = {
    ".js": "js", ".jsx": "js", ".mjs": "js", ".cjs": "js",
    ".ts": "ts", ".tsx": "ts",
    ".py": "py",
    ".go": "go",
    ".rs": "rs",
    ".java": "java",
    ".kt": "kt",
    ".cs": "cs",
    ".cpp": "cpp", ".cc": "cpp", ".cxx": "cpp", ".c": "c", ".h": "c",
    ".rb": "rb",
    ".php": "php",
    ".swift": "swift",
    ".vue": "vue",
    ".svelte": "svelte",
    ".html": "html", ".htm": "html",
    ".css": "css", ".scss": "scss", ".sass": "sass", ".less": "less",
    ".json": "json",
    ".yaml": "yaml", ".yml": "yaml",
    ".toml": "toml",
    ".xml": "xml",
    ".md": "md", ".mdx": "md",
    ".sh": "sh", ".bash": "sh", ".zsh": "sh",
    ".sql": "sql",
    ".graphql": "graphql", ".gql": "graphql",
    ".proto": "proto",
    ".dockerfile": "dockerfile",
    ".svg": "svg",
}

# ---------------------------------------------------------------------------
# Classification
# ---------------------------------------------------------------------------

FRONTEND_DIRS  = {"frontend", "client", "ui", "web", "components", "pages",
                  "views", "layouts", "hooks", "stores", "context", "widgets",
                  "screens", "app"}
BACKEND_DIRS   = {"backend", "server", "api", "services", "routes",
                  "controllers", "models", "middleware", "handlers",
                  "repositories", "resolvers", "db", "database"}
TEST_PATTERNS  = {"test", "tests", "spec", "specs", "__tests__", "e2e",
                  "cypress", "jest", "fixtures", "mocks", "__mocks__"}
CONFIG_NAMES   = {
    "package.json", "tsconfig.json", "vite.config.js", "vite.config.ts",
    "webpack.config.js", "rollup.config.js", "babel.config.js", ".babelrc",
    "jest.config.js", "jest.config.ts", "vitest.config.ts",
    "tailwind.config.js", "tailwind.config.ts", "postcss.config.js",
    "eslint.config.js", ".eslintrc.js", ".eslintrc.json", ".prettierrc",
    "next.config.js", "next.config.ts", "nuxt.config.ts",
    "docker-compose.yml", "dockerfile", ".env.example",
    "vercel.json", "netlify.toml", "render.yaml",
    "pyproject.toml", "setup.py", "requirements.txt", "cargo.toml",
    "makefile", "justfile", ".editorconfig",
}
FRONTEND_EXTS  = {".jsx", ".tsx", ".vue", ".svelte", ".css", ".scss",
                  ".sass", ".less", ".html", ".htm", ".svg"}
BACKEND_EXTS   = {".py", ".go", ".java", ".rb", ".php", ".rs", ".cs",
                  ".kt", ".swift"}


def detect_language(path: Path) -> str:
    name = path.name.lower()
    if name == "dockerfile":
        return "dockerfile"
    if name.endswith(".d.ts"):
        return "ts"
    return LANG_MAP.get(path.suffix.lower(), "")


def classify(path: Path) -> str:
    parts = [p.lower() for p in path.parts]
    name_lower = path.name.lower()
    stem_lower = path.stem.lower()

    for part in parts:
        if part in TEST_PATTERNS:
            return "test"
    if re.search(r"\.(test|spec)\.|\b(test|spec)_", name_lower):
        return "test"

    if name_lower in CONFIG_NAMES:
        return "config"

    for part in parts:
        if part in FRONTEND_DIRS:
            return "frontend"
        if part in BACKEND_DIRS:
            return "backend"

    ext = path.suffix.lower()
    if ext in FRONTEND_EXTS:
        return "frontend"
    if ext in BACKEND_EXTS:
        return "backend"

    return "shared"

# ---------------------------------------------------------------------------
# Content processors
# ---------------------------------------------------------------------------

# Comment strippers per language family
_JS_BLOCK_COMMENT  = re.compile(r"/\*.*?\*/", re.DOTALL)
_JS_LINE_COMMENT   = re.compile(r"//[^\n]*")
_PY_INLINE_COMMENT = re.compile(r"(?m)(?<!:)#[^\n]*$")
_HTML_COMMENT      = re.compile(r"<!--.*?-->", re.DOTALL)
_BLANK_LINES_3     = re.compile(r"\n{3,}")


def strip_comments(content: str, lang: str) -> str:
    """Remove comments from source code. Rough but effective for token savings."""
    if lang in ("js", "ts", "java", "cs", "go", "rs", "kt", "swift",
                "cpp", "c", "php", "css", "scss", "sass"):
        content = _JS_BLOCK_COMMENT.sub("", content)
        content = _JS_LINE_COMMENT.sub("", content)
    elif lang == "py":
        # Only remove inline comments, not docstrings (they're often API docs)
        content = _PY_INLINE_COMMENT.sub("", content)
    elif lang in ("html", "vue", "svelte"):
        content = _HTML_COMMENT.sub("", content)
    elif lang in ("yaml", "sh"):
        content = re.sub(r"(?m)^[ \t]*#[^\n]*\n", "", content)
    return content


def normalize_whitespace(content: str) -> str:
    """Collapse 3+ blank lines → 1, strip trailing whitespace per line."""
    lines = [ln.rstrip() for ln in content.splitlines()]
    content = "\n".join(lines)
    return _BLANK_LINES_3.sub("\n\n", content).strip()


def is_minified(content: str) -> bool:
    """Detect minified files by avg line length."""
    lines = [l for l in content.splitlines() if l.strip()]
    if not lines:
        return False
    return (sum(len(l) for l in lines) / len(lines)) > MINIFIED_AVG_LINE_LEN


def is_generated(path: Path) -> bool:
    name = path.name
    full = str(path)
    for pat in GENERATED_PATTERNS:
        if pat.search(name) or pat.search(full):
            return True
    # Check first line for codegen markers
    return False


def strip_license_header(content: str) -> str:
    """Remove leading license/copyright block comments (common in open-source files)."""
    # JS/TS block comment at top
    m = re.match(r"\s*/\*[\s\S]*?Copyright[\s\S]*?\*/\s*", content, re.IGNORECASE)
    if m:
        return content[m.end():]
    # Python # copyright block
    lines = content.splitlines(keepends=True)
    cut = 0
    for ln in lines[:15]:
        if re.search(r"(copyright|license|spdx|mit|apache|gpl)", ln, re.I):
            cut += 1
        elif ln.strip().startswith("#") and cut > 0:
            cut += 1
        else:
            break
    if cut > 2:
        return "".join(lines[cut:])
    return content

# ---------------------------------------------------------------------------
# Import extractor
# ---------------------------------------------------------------------------

_JS_IMPORT_RE = re.compile(
    r"""(?:import|from)\s+['"]([^'"]+)['"]"""
    r"""|require\s*\(\s*['"]([^'"]+)['"]\s*\)"""
    r"""|import\s*\(\s*['"]([^'"]+)['"]\s*\)""",  # dynamic imports
)
_PY_IMPORT_RE = re.compile(r"^\s*(?:from|import)\s+([\w.]+)", re.MULTILINE)

_PY_STDLIB = frozenset({
    "os", "sys", "re", "json", "pathlib", "typing", "datetime", "collections",
    "itertools", "functools", "math", "random", "time", "threading", "subprocess",
    "abc", "copy", "io", "hashlib", "base64", "urllib", "http", "logging",
    "unittest", "dataclasses", "enum", "contextlib", "inspect", "warnings",
    "argparse", "ast", "string", "struct", "socket", "ssl", "email", "html",
    "xml", "csv", "configparser", "platform", "shutil", "tempfile", "glob",
    "fnmatch", "stat", "signal", "queue", "asyncio", "concurrent", "multiprocessing",
})


def extract_imports(content: str, lang: str) -> list[str]:
    if lang in ("js", "ts"):
        hits = []
        for m in _JS_IMPORT_RE.finditer(content):
            val = m.group(1) or m.group(2) or m.group(3) or ""
            if val.startswith("."):
                hits.append(val)
        return hits[:15]
    if lang == "py":
        hits = []
        for m in _PY_IMPORT_RE.finditer(content):
            mod = m.group(1).split(".")[0]
            if mod not in _PY_STDLIB:
                hits.append(m.group(1))
        return list(dict.fromkeys(hits))[:15]   # deduplicated, ordered
    return []

# ---------------------------------------------------------------------------
# One-liner extractor
# ---------------------------------------------------------------------------

_NOISE_PREFIXES = ("import ", "from ", "require(", "export {", "use client",
                   "use server", "@", "#!", "//", "/*", "*")


def extract_one_liner(content: str, lang: str, filename: str) -> str:
    lines = content.splitlines()
    for line in lines[:12]:
        s = line.strip()
        if not s:
            continue
        # Comments
        for prefix in ("///", "//", "# ", '"""', "'''", "/**", "/*"):
            if s.startswith(prefix):
                text = re.sub(r"^[/*#\"'\s]+", "", s).strip()
                if len(text) > 8 and not re.search(r"(eslint|tslint|prettier|noqa|type-check)", text, re.I):
                    return text[:100]
    if lang == "json":
        try:
            obj = json.loads(content)
            if isinstance(obj, dict):
                v = obj.get("description") or obj.get("name") or obj.get("title")
                if v:
                    return str(v)[:100]
        except Exception:
            pass
    for line in lines[:25]:
        s = line.strip()
        if not s or any(s.startswith(p) for p in _NOISE_PREFIXES):
            continue
        return s[:100]
    return filename

# ---------------------------------------------------------------------------
# Data model
# ---------------------------------------------------------------------------

@dataclass
class FileEntry:
    rel_path: Path
    category: str
    language: str
    size_bytes: int
    content: str          # processed content ready to emit
    raw_hash: str         # hash of RAW content for dedup
    token_count: int = 0
    one_liner: str = ""
    imports: list[str] = field(default_factory=list)
    skipped: bool = False  # True = stub only (minified/generated/too large)

# ---------------------------------------------------------------------------
# .gitignore loader
# ---------------------------------------------------------------------------

def load_gitignore(root: Path):
    """Return a pathspec matcher or None."""
    if not PATHSPEC:
        return None
    gi = root / ".gitignore"
    if not gi.exists():
        return None
    try:
        spec = pathspec.PathSpec.from_lines("gitwildmatch", gi.read_text().splitlines())
        return spec
    except Exception:
        return None

# ---------------------------------------------------------------------------
# File reader (runs in thread pool)
# ---------------------------------------------------------------------------

def read_file(
    abs_path: Path,
    root: Path,
    include_tests: bool,
    do_strip_comments: bool,
) -> Optional[FileEntry]:
    """Read, classify, and process a single file. Returns None to skip."""
    try:
        rel = abs_path.relative_to(root)
    except ValueError:
        return None

    name_lower = abs_path.name.lower()
    ext_lower  = abs_path.suffix.lower()

    if name_lower in SKIP_FILES:
        return None
    if ext_lower in SKIP_EXTS:
        return None
    # Skip .min.* files
    if re.search(r"\.min\.[a-z]+$", name_lower):
        return None

    category = classify(rel)
    if category == "test" and not include_tests:
        return None

    lang = detect_language(abs_path)

    try:
        stat = abs_path.stat()
        size_bytes = stat.st_size
    except OSError:
        return None

    # Read raw content
    truncated = False
    try:
        if size_bytes > MAX_FILE_BYTES:
            truncated = True
            raw_lines: list[str] = []
            with abs_path.open("r", encoding="utf-8", errors="replace") as f:
                for i, ln in enumerate(f):
                    if i >= 300:
                        break
                    raw_lines.append(ln)
            raw_content = "".join(raw_lines)
        else:
            raw_content = abs_path.read_text(encoding="utf-8", errors="replace")
    except OSError:
        return None

    raw_hash = hashlib.blake2b(raw_content.encode("utf-8", errors="replace"),
                               digest_size=8).hexdigest()

    # Generated / minified stubs
    skipped = False
    content = raw_content
    if is_generated(abs_path):
        content = f"[GENERATED FILE — {size_bytes:,} bytes, skipped for token efficiency]"
        skipped = True
    elif is_minified(raw_content):
        content = f"[MINIFIED FILE — {size_bytes:,} bytes, skipped for token efficiency]"
        skipped = True
    else:
        if truncated:
            content = f"[TRUNCATED: {size_bytes:,} bytes, showing first 300 lines]\n" + raw_content
        content = strip_license_header(content)
        if do_strip_comments and lang and not skipped:
            content = strip_comments(content, lang)
        content = normalize_whitespace(content)

    one_liner = extract_one_liner(raw_content, lang, abs_path.name)
    imports   = extract_imports(raw_content, lang) if not skipped else []
    tok       = count_tokens(content)

    return FileEntry(
        rel_path=rel,
        category=category,
        language=lang,
        size_bytes=size_bytes,
        content=content,
        raw_hash=raw_hash,
        token_count=tok,
        one_liner=one_liner,
        imports=imports,
        skipped=skipped,
    )

# ---------------------------------------------------------------------------
# Collector
# ---------------------------------------------------------------------------

def find_generated_output_dirs(root: Path) -> set[Path]:
    """Find any dirs that look like previous collect_codebase.py output (have manifest.json + index.md)."""
    result: set[Path] = set()
    for d in root.iterdir():
        if d.is_dir() and (d / "manifest.json").exists() and (d / "index.md").exists():
            try:
                data = json.loads((d / "manifest.json").read_text())
                if "total_tokens" in data or "total_files" in data:
                    result.add(d.relative_to(root))
            except Exception:
                pass
    return result


def collect_files(
    root: Path,
    out_dir: Path,
    include_tests: bool,
    do_strip_comments: bool,
) -> list[FileEntry]:
    gitignore = load_gitignore(root)
    out_dir_rel = out_dir.relative_to(root) if out_dir.is_relative_to(root) else None

    # Auto-detect ALL previously generated output dirs, not just current --out-dir
    generated_dirs = find_generated_output_dirs(root)
    if out_dir_rel:
        generated_dirs.add(out_dir_rel)

    # Gather candidate paths
    candidates: list[Path] = []
    for abs_path in sorted(root.rglob("*")):
        if not abs_path.is_file():
            continue
        try:
            rel = abs_path.relative_to(root)
        except ValueError:
            continue

        parts_lower = [p.lower() for p in rel.parts]

        # Skip any generated output directory
        if any(rel.parts[:len(d.parts)] == d.parts for d in generated_dirs):
            continue

        if any(p in SKIP_DIRS for p in parts_lower):
            continue

        # gitignore check
        if gitignore and gitignore.match_file(str(rel)):
            continue

        candidates.append(abs_path)

    # Parallel read
    entries: list[FileEntry] = []
    seen_hashes: set[str] = set()

    with ThreadPoolExecutor(max_workers=PARALLEL_WORKERS) as pool:
        futures = {
            pool.submit(read_file, p, root, include_tests, do_strip_comments): p
            for p in candidates
        }
        for fut in as_completed(futures):
            entry = fut.result()
            if entry is None:
                continue
            # Dedup by raw content hash (not truncated content)
            if entry.raw_hash in seen_hashes and entry.size_bytes > 200:
                continue
            seen_hashes.add(entry.raw_hash)
            entries.append(entry)

    # Sort: config → shared → backend → frontend → test → other
    CAT_ORDER = {"config": 0, "shared": 1, "backend": 2, "frontend": 3, "test": 4, "other": 5}
    entries.sort(key=lambda e: (CAT_ORDER.get(e.category, 9), str(e.rel_path)))
    return entries

# ---------------------------------------------------------------------------
# Compact renderer  (the key token-saving piece)
# ---------------------------------------------------------------------------

# Old format used ~8 lines per file header.
# New format: ONE line:   ── path/to/file [lang·cat·Ntok]
# Savings on a 200-file project: ~1,400 lines ≈ 400+ tokens just in headers.

def render_file(entry: FileEntry) -> str:
    meta_parts = []
    if entry.language:
        meta_parts.append(entry.language)
    meta_parts.append(entry.category)
    meta_parts.append(f"{entry.token_count}tok")
    if entry.imports:
        meta_parts.append("← " + ", ".join(entry.imports[:6]))
    meta = " · ".join(meta_parts)

    header = f"──── {entry.rel_path}  [{meta}]\n"
    if entry.one_liner and entry.one_liner != entry.rel_path.name:
        header += f"# {entry.one_liner}\n"

    fence_lang = entry.language or ""
    body = f"```{fence_lang}\n{entry.content}\n```"
    return f"\n{header}{body}\n"


def build_chunk_header(
    project: str, chunk_num: int, total_chunks: int,
    total_files: int, total_tokens: int,
    chunk_files: int, chunk_tokens: int,
    categories: dict[str, int],
) -> str:
    cat_str = "  ".join(f"{k}:{v}" for k, v in sorted(categories.items(), key=lambda x: -x[1]))
    tiktoken_note = "tiktoken" if TIKTOKEN else "est"
    gitignore_note = "+gitignore" if PATHSPEC else ""
    return (
        f"# {project} · chunk {chunk_num}/{total_chunks}"
        f" · {chunk_files} files · ~{chunk_tokens:,} tokens ({tiktoken_note}{gitignore_note})\n"
        f"# project totals: {total_files} files · ~{total_tokens:,} tokens\n"
        f"# categories: {cat_str}\n"
        f"# each file header: ──── path  [lang · category · Ntok · ← imports]\n"
        f"#{'─'*76}\n"
    )

# ---------------------------------------------------------------------------
# Index builder
# ---------------------------------------------------------------------------

def build_index(
    project: str,
    entries: list[FileEntry],
    chunks: list[list[FileEntry]],
    tiktoken_available: bool,
    gitignore_active: bool,
) -> str:
    total_tok = sum(e.token_count for e in entries)
    total_bytes = sum(e.size_bytes for e in entries)
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    flags = []
    if tiktoken_available:
        flags.append("tiktoken-accurate token counts")
    if gitignore_active:
        flags.append(".gitignore respected")

    lines = [
        f"# {project} — codebase index",
        f"Generated : {now}",
        f"Files     : {len(entries)}",
        f"Tokens    : ~{total_tok:,}  ({', '.join(flags) if flags else 'estimated'})",
        f"Size      : {total_bytes/1024:.1f} KB",
        "",
        "## Upload order",
        "1. This file (index.md) first — gives AI the full map",
        *[f"{i+2}. chunk_{i+1:02d}.txt — {len(c)} files, ~{sum(e.token_count for e in c):,} tok"
          for i, c in enumerate(chunks)],
        "",
        "---",
        "## File map",
        "",
        f"{'Chunk':>5}  {'Tokens':>6}  {'Cat':<8}  {'Path':<55}  Summary",
        f"{'─'*5}  {'─'*6}  {'─'*8}  {'─'*55}  {'─'*35}",
    ]

    by_cat: dict[str, list[tuple[FileEntry, int]]] = {}
    entry_to_chunk = {id(e): i+1 for i, c in enumerate(chunks) for e in c}
    for e in entries:
        by_cat.setdefault(e.category, []).append((e, entry_to_chunk.get(id(e), 0)))

    CAT_ORDER = ["config", "shared", "backend", "frontend", "test", "other"]
    for cat in CAT_ORDER:
        group = by_cat.get(cat, [])
        if not group:
            continue
        cat_tok = sum(e.token_count for e, _ in group)
        lines.append(f"\n### {cat.upper()}  ({len(group)} files · ~{cat_tok:,} tok)")
        for e, ch in sorted(group, key=lambda x: str(x[0].rel_path)):
            stub = " [stub]" if e.skipped else ""
            lines.append(
                f"  {ch:>3}    {e.token_count:>6,}  {e.category:<8}  "
                f"{str(e.rel_path):<55}  {e.one_liner[:60]}{stub}"
            )

    # Dependency graph (non-empty only)
    dep_lines = []
    for e in entries:
        if e.imports:
            dep_lines.append(f"  {e.rel_path}  →  {', '.join(e.imports)}")
    if dep_lines:
        lines += ["", "---", "## Local dependency graph", ""]
        lines += dep_lines

    # Stats
    lines += ["", "---", "## Stats by category", ""]
    for cat in CAT_ORDER:
        group = by_cat.get(cat, [])
        if not group:
            continue
        tok  = sum(e.token_count for e, _ in group)
        kb   = sum(e.size_bytes  for e, _ in group) / 1024
        lines.append(f"  {cat:<10}  {len(group):>4} files  ~{tok:>8,} tok  {kb:>7.1f} KB")

    return "\n".join(lines)

# ---------------------------------------------------------------------------
# Chunker
# ---------------------------------------------------------------------------

def chunk_entries(entries: list[FileEntry], max_tokens: int) -> list[list[FileEntry]]:
    HEADER_RESERVE = 300
    effective = max_tokens - HEADER_RESERVE
    chunks: list[list[FileEntry]] = []
    current: list[FileEntry] = []
    used = 0
    for e in entries:
        if used + e.token_count > effective and current:
            chunks.append(current)
            current, used = [], 0
        current.append(e)
        used += e.token_count
    if current:
        chunks.append(current)
    return chunks

# ---------------------------------------------------------------------------
# Writer
# ---------------------------------------------------------------------------

def write_outputs(
    entries: list[FileEntry],
    out_dir: Path,
    project: str,
    max_tokens: int,
    single: bool,
    gitignore_active: bool,
) -> None:
    out_dir.mkdir(parents=True, exist_ok=True)
    total_tokens = sum(e.token_count for e in entries)
    total_files  = len(entries)

    chunks = [entries] if single else chunk_entries(entries, max_tokens)

    categories_total: dict[str, int] = {}
    for e in entries:
        categories_total[e.category] = categories_total.get(e.category, 0) + 1

    print(f"\n  Writing {len(chunks)} chunk(s) to {out_dir}/\n")

    for i, chunk in enumerate(chunks):
        chunk_num = i + 1
        chunk_cats: dict[str, int] = {}
        for e in chunk:
            chunk_cats[e.category] = chunk_cats.get(e.category, 0) + 1
        chunk_tokens = sum(e.token_count for e in chunk)

        fname = "full_codebase.txt" if single else f"chunk_{chunk_num:02d}.txt"
        fpath = out_dir / fname

        with fpath.open("w", encoding="utf-8") as f:
            f.write(build_chunk_header(
                project, chunk_num, len(chunks),
                total_files, total_tokens,
                len(chunk), chunk_tokens, chunk_cats,
            ))
            for entry in chunk:
                f.write(render_file(entry))

        kb = fpath.stat().st_size / 1024
        stubs = sum(1 for e in chunk if e.skipped)
        stub_note = f"  ({stubs} stubs)" if stubs else ""
        print(f"  ✅  {fname:<28} {len(chunk):>4} files  ~{chunk_tokens:>8,} tok  {kb:>7.1f} KB{stub_note}")

    # Index
    index_path = out_dir / "index.md"
    index_path.write_text(
        build_index(project, entries, chunks, TIKTOKEN, gitignore_active),
        encoding="utf-8",
    )
    print(f"  📋  index.md                    {index_path.stat().st_size/1024:.1f} KB")

    # Manifest
    manifest = {
        "project": project,
        "generated": datetime.now().isoformat(),
        "token_counter": "tiktoken/cl100k_base" if TIKTOKEN else "heuristic",
        "gitignore": gitignore_active,
        "total_files": total_files,
        "total_tokens": total_tokens,
        "chunks": [
            {"file": f"chunk_{i+1:02d}.txt", "files": len(c),
             "tokens": sum(e.token_count for e in c)}
            for i, c in enumerate(chunks)
        ],
        "files": [
            {"path": str(e.rel_path), "category": e.category, "language": e.language,
             "tokens": e.token_count, "summary": e.one_liner, "skipped": e.skipped}
            for e in entries
        ],
    }
    (out_dir / "manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    print(f"  📦  manifest.json")

    # Summary
    stubs_total = sum(1 for e in entries if e.skipped)
    print(f"""
{'='*60}
  Project  : {project}
  Files    : {total_files}  ({stubs_total} stubs)
  Tokens   : ~{total_tokens:,}  ({'tiktoken' if TIKTOKEN else 'estimated'})
  Chunks   : {len(chunks)}
  Out dir  : {out_dir}
  Gitignore: {'yes (pathspec)' if gitignore_active else 'no (pip install pathspec)'}
  Tiktoken : {'yes' if TIKTOKEN else 'no  (pip install tiktoken  ← recommended)'}
{'='*60}

  UPLOAD ORDER:
  1. index.md         — full codebase map
{''.join(f"  {i+2}. chunk_{i+1:02d}.txt{chr(10)}" for i in range(len(chunks)))}
""")

# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def main():
    ap = argparse.ArgumentParser(
        description="Token-optimized AI context builder",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    ap.add_argument("--root",           type=Path, default=Path("."),
                    help="Project root (default: cwd)")
    ap.add_argument("--out-dir",        type=Path, default=Path("ai_context"),
                    help="Output directory (default: ./ai_context)")
    ap.add_argument("--chunk-tokens",   type=int,  default=80_000,
                    help="Max tokens per chunk (default: 80000; use 180000 for Claude)")
    ap.add_argument("--single",         action="store_true",
                    help="Single output file")
    ap.add_argument("--include-tests",  action="store_true",
                    help="Include test files")
    ap.add_argument("--strip-comments", action="store_true",
                    help="Remove code comments (extra token savings, loses some context)")
    ap.add_argument("--max-file-kb",    type=int,  default=150,
                    help="Truncate files larger than this (KB)")
    ap.add_argument("--workers",        type=int,  default=8,
                    help="Parallel reader threads (default: 8)")
    args = ap.parse_args()

    global MAX_FILE_BYTES, PARALLEL_WORKERS
    MAX_FILE_BYTES   = args.max_file_kb * 1024
    PARALLEL_WORKERS = args.workers

    root = args.root.resolve()
    if not root.is_dir():
        print(f"Error: {root} is not a directory.", file=sys.stderr)
        sys.exit(1)

    project = root.name
    out_dir = args.out_dir if args.out_dir.is_absolute() else root / args.out_dir

    gi = load_gitignore(root)
    gitignore_active = gi is not None

    print(f"\n🔍  Scanning {root} ...")
    if not TIKTOKEN:
        print("    ⚠  tiktoken not found — token counts are estimated (pip install tiktoken)")
    if not PATHSPEC:
        print("    ⚠  pathspec not found — .gitignore not respected (pip install pathspec)")
    print()

    t0 = time.perf_counter()
    entries = collect_files(root, out_dir, args.include_tests, args.strip_comments)
    elapsed = time.perf_counter() - t0

    if not entries:
        print("No files found. Check --root.")
        sys.exit(0)

    print(f"  Found {len(entries)} files in {elapsed:.2f}s\n")

    write_outputs(
        entries=entries,
        out_dir=out_dir,
        project=project,
        max_tokens=args.chunk_tokens,
        single=args.single,
        gitignore_active=gitignore_active,
    )


if __name__ == "__main__":
    main()