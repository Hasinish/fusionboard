#!/usr/bin/env python3
"""
collect_codebase.py — Token-optimized AI context builder
=========================================================

USAGE
-----
  python collect_codebase.py                          # auto-chunks at 80k tokens
  python collect_codebase.py --chunk-tokens 180000   # fewer, bigger chunks
  python collect_codebase.py --single                # one file (small projects)
  python collect_codebase.py --strip-comments        # conservative, safe comment stripping
  python collect_codebase.py --include-tests         # include test files
  python collect_codebase.py --out-dir ./ctx         # custom output dir

OUTPUT  (→ ./ai_context/)
  index.md       full file map — upload first
  chunk_01.txt   source chunk 1
  chunk_02.txt   source chunk 2 (if needed)
  manifest.json  machine-readable summary

NOTES
-----
  • Comment stripping is intentionally conservative. It is only applied where it
    can be done safely without parser-driven corruption. Today that means Python
    comments are stripped using the stdlib tokenizer; other languages are left
    untouched to avoid corrupting strings/template literals.
  • Dedup uses a full-file streaming hash. In default mode it only deduplicates
    obvious low-signal duplicates (generated/stubbed files and tiny barrel files);
    --strict disables dedup entirely.
  • Chunking counts full rendered file blocks (headers + fences + content), then
    iteratively rebalances chunks against the actual chunk-header token budget.
  • Structured text formats (JSON/YAML/TOML/SQL/GraphQL/XML/Markdown) are not
    stubbed as minified when --no-structured-text-stub is used.
  • .gitignore support is limited to the repository root .gitignore (if
    pathspec is installed). Nested .gitignore files are not interpreted.
"""

from __future__ import annotations

import argparse
import ast
import hashlib
import io
import json
import os
import re
import sys
import time
import tokenize
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Iterable, Optional

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
    TIKTOKEN = False

    def count_tokens(text: str) -> int:
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
    "node_modules",
    ".git",
    "__pycache__",
    ".next",
    "dist",
    "build",
    ".venv",
    "venv",
    ".env",
    "coverage",
    ".nyc_output",
    ".cache",
    "tmp",
    "temp",
    ".turbo",
    ".vercel",
    ".netlify",
    "out",
    ".expo",
    "ios",
    "android",
    ".gradle",
    "target",
    "vendor",
    "bower_components",
    ".idea",
    ".vscode",
    "__mocks__",
    ".pytest_cache",
    ".mypy_cache",
    "storybook-static",
    ".storybook",
}

SKIP_FILES: set[str] = {
    "package-lock.json",
    "yarn.lock",
    "pnpm-lock.yaml",
    "bun.lockb",
    ".env",
    ".env.local",
    ".env.production",
    ".env.development",
    ".gitignore",
    ".gitattributes",
    ".eslintignore",
    ".prettierignore",
    "thumbs.db",
    ".ds_store",
    "desktop.ini",
    "tsconfig.tsbuildinfo",
    ".npmignore",
    "collect_codebase.py",
}

SKIP_EXTS: set[str] = {
    ".png",
    ".jpg",
    ".jpeg",
    ".gif",
    ".webp",
    ".ico",
    ".bmp",
    ".tiff",
    ".psd",
    ".ai",
    ".sketch",
    ".fig",
    ".woff",
    ".woff2",
    ".ttf",
    ".eot",
    ".otf",
    ".zip",
    ".tar",
    ".gz",
    ".rar",
    ".7z",
    ".exe",
    ".dll",
    ".so",
    ".dylib",
    ".mp4",
    ".mp3",
    ".wav",
    ".mov",
    ".avi",
    ".pdf",
    ".sqlite",
    ".db",
    ".parquet",
    ".lock",
    ".snap",
    ".map",
}

GENERATED_PATTERNS: list[re.Pattern[str]] = [
    re.compile(r"\.d\.ts$"),
    re.compile(r"\.generated\.(ts|js|graphql)$"),
    re.compile(r"__generated__"),
    re.compile(r"\.pb\.go$"),
    re.compile(r"_pb2\.py$"),
]

MINIFIED_AVG_LINE_LEN = 500
MAX_FILE_BYTES = 150_000
PARALLEL_WORKERS = 8
DEDUP_MIN_BYTES = 500
BINARY_SAMPLE_BYTES = 8192
CHUNK_BALANCE_MAX_PASSES = 8
STRUCTURED_TEXT_LANGS = {"json", "yaml", "toml", "sql", "graphql", "xml", "md"}

# ---------------------------------------------------------------------------
# Language map
# ---------------------------------------------------------------------------

LANG_MAP: dict[str, str] = {
    ".js": "js",
    ".jsx": "js",
    ".mjs": "js",
    ".cjs": "js",
    ".ts": "ts",
    ".tsx": "ts",
    ".py": "py",
    ".go": "go",
    ".rs": "rs",
    ".java": "java",
    ".kt": "kt",
    ".cs": "cs",
    ".cpp": "cpp",
    ".cc": "cpp",
    ".cxx": "cpp",
    ".c": "c",
    ".h": "c",
    ".rb": "rb",
    ".php": "php",
    ".swift": "swift",
    ".vue": "vue",
    ".svelte": "svelte",
    ".html": "html",
    ".htm": "html",
    ".css": "css",
    ".scss": "scss",
    ".sass": "sass",
    ".less": "less",
    ".json": "json",
    ".yaml": "yaml",
    ".yml": "yaml",
    ".toml": "toml",
    ".xml": "xml",
    ".md": "md",
    ".mdx": "md",
    ".sh": "sh",
    ".bash": "sh",
    ".zsh": "sh",
    ".sql": "sql",
    ".graphql": "graphql",
    ".gql": "graphql",
    ".proto": "proto",
    ".dockerfile": "dockerfile",
    ".svg": "svg",
}

# ---------------------------------------------------------------------------
# Classification
# ---------------------------------------------------------------------------

FRONTEND_DIRS = {
    "frontend",
    "client",
    "ui",
    "web",
    "components",
    "pages",
    "views",
    "layouts",
    "hooks",
    "stores",
    "context",
    "widgets",
    "screens",
}
BACKEND_DIRS = {
    "backend",
    "server",
    "api",
    "services",
    "routes",
    "controllers",
    "models",
    "middleware",
    "handlers",
    "repositories",
    "resolvers",
    "db",
    "database",
}
TEST_PATTERNS = {
    "test",
    "tests",
    "spec",
    "specs",
    "__tests__",
    "e2e",
    "cypress",
    "jest",
    "fixtures",
    "mocks",
    "__mocks__",
}
CONFIG_NAMES = {
    "package.json",
    "tsconfig.json",
    "vite.config.js",
    "vite.config.ts",
    "webpack.config.js",
    "rollup.config.js",
    "babel.config.js",
    ".babelrc",
    "jest.config.js",
    "jest.config.ts",
    "vitest.config.ts",
    "tailwind.config.js",
    "tailwind.config.ts",
    "postcss.config.js",
    "eslint.config.js",
    ".eslintrc.js",
    ".eslintrc.json",
    ".prettierrc",
    "next.config.js",
    "next.config.ts",
    "nuxt.config.ts",
    "docker-compose.yml",
    "dockerfile",
    ".env.example",
    "vercel.json",
    "netlify.toml",
    "render.yaml",
    "pyproject.toml",
    "setup.py",
    "requirements.txt",
    "cargo.toml",
    "makefile",
    "justfile",
    ".editorconfig",
}
FRONTEND_EXTS = {
    ".jsx",
    ".tsx",
    ".vue",
    ".svelte",
    ".css",
    ".scss",
    ".sass",
    ".less",
    ".html",
    ".htm",
    ".svg",
}
BACKEND_EXTS = {".py", ".go", ".java", ".rb", ".php", ".rs", ".cs", ".kt", ".swift"}

# ---------------------------------------------------------------------------
# Content processors
# ---------------------------------------------------------------------------

_BLANK_LINES_3 = re.compile(r"\n{3,}")
_CODEGEN_MARKERS = re.compile(
    r"(do not edit|auto.?generated|generated by|this file is generated|@generated|code generated)",
    re.IGNORECASE,
)
_JS_IMPORT_RE = re.compile(
    r"""(?:import|from)\s+['\"]([^'\"]+)['\"]"""
    r"""|require\s*\(\s*['\"]([^'\"]+)['\"]\s*\)"""
    r"""|import\s*\(\s*['\"]([^'\"]+)['\"]\s*\)"""
)
_PY_STDLIB = frozenset(
    {
        "os",
        "sys",
        "re",
        "json",
        "pathlib",
        "typing",
        "datetime",
        "collections",
        "itertools",
        "functools",
        "math",
        "random",
        "time",
        "threading",
        "subprocess",
        "abc",
        "copy",
        "io",
        "hashlib",
        "base64",
        "urllib",
        "http",
        "logging",
        "unittest",
        "dataclasses",
        "enum",
        "contextlib",
        "inspect",
        "warnings",
        "argparse",
        "ast",
        "string",
        "struct",
        "socket",
        "ssl",
        "email",
        "html",
        "xml",
        "csv",
        "configparser",
        "platform",
        "shutil",
        "tempfile",
        "glob",
        "fnmatch",
        "stat",
        "signal",
        "queue",
        "asyncio",
        "concurrent",
        "multiprocessing",
    }
)
_NOISE_PREFIXES = (
    "import ",
    "from ",
    "require(",
    "export {",
    "use client",
    "use server",
    "@",
    "#!",
    "//",
    "/*",
    "*",
)


@dataclass
class FileEntry:
    rel_path: Path
    category: str
    language: str
    size_bytes: int
    content: str
    raw_hash: str
    body_token_count: int = 0
    token_count: int = 0
    one_liner: str = ""
    imports: list[str] = field(default_factory=list)
    skipped: bool = False


def posix_rel(path: Path) -> str:
    return str(path).replace("\\", "/")


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

    frontend_match = None
    backend_match = None
    for part in parts:
        if part in TEST_PATTERNS:
            return "test"
        if frontend_match is None and part in FRONTEND_DIRS:
            frontend_match = part
        if backend_match is None and part in BACKEND_DIRS:
            backend_match = part

    if re.search(r"\.(test|spec)\.|_(test|spec)\.", name_lower):
        return "test"
    stem = name_lower.rsplit(".", 1)[0] if "." in name_lower else name_lower
    if stem in {"test", "tests", "spec", "specs"}:
        return "test"

    if name_lower in CONFIG_NAMES:
        return "config"
    if frontend_match:
        return "frontend"
    if backend_match:
        return "backend"

    ext = path.suffix.lower()
    if ext in FRONTEND_EXTS:
        return "frontend"
    if ext in BACKEND_EXTS:
        return "backend"
    return "shared"


def normalize_whitespace(content: str) -> str:
    lines = [ln.rstrip() for ln in content.splitlines()]
    content = "\n".join(lines)
    return _BLANK_LINES_3.sub("\n\n", content).strip()


def strip_python_comments(content: str) -> str:
    """Safely strip Python COMMENT tokens while preserving strings/docstrings."""
    try:
        tokens = tokenize.generate_tokens(io.StringIO(content).readline)
        kept: list[tokenize.TokenInfo] = []
        for tok in tokens:
            if tok.type != tokenize.COMMENT:
                kept.append(tok)
                continue

            line_no = tok.start[0]
            if line_no == 1 and tok.string.startswith("#!"):
                kept.append(tok)
                continue
            if line_no <= 2 and "coding" in tok.string:
                kept.append(tok)
                continue
            # Drop all other Python comments.
        return tokenize.untokenize(kept)
    except (tokenize.TokenError, IndentationError):
        return content


def strip_comments(content: str, lang: str) -> str:
    """Conservative comment stripping.

    To avoid corrupting strings/template literals, we only strip comments where we
    can do so safely without a language parser. At the moment that means Python
    via the stdlib tokenizer. Other languages are returned unchanged on purpose.
    """
    if lang == "py":
        return strip_python_comments(content)
    return content


def is_minified(content: str, language: str, allow_structured_text_stub: bool = True) -> bool:
    if not allow_structured_text_stub and language in STRUCTURED_TEXT_LANGS:
        return False
    lines = [line for line in content.splitlines() if line.strip()]
    if not lines:
        return False
    return (sum(len(line) for line in lines) / len(lines)) > MINIFIED_AVG_LINE_LEN


def is_generated(path: Path, first_lines: str = "") -> bool:
    name = path.name
    full = str(path)
    for pat in GENERATED_PATTERNS:
        if pat.search(name) or pat.search(full):
            return True
    if first_lines and _CODEGEN_MARKERS.search(first_lines):
        return True
    return False


def strip_license_header(content: str) -> str:
    """Remove obvious top-of-file license headers while avoiding inline code."""
    block = re.match(r"\A\s*/\*[\s\S]*?\*/\s*", content)
    if block and re.search(r"\b(copyright|license|spdx|mit|apache|gpl)\b", block.group(0), re.I):
        return content[block.end() :]

    lines = content.splitlines(keepends=True)
    cut = 0
    lic_kw = re.compile(r"\b(copyright|license|spdx|mit|apache|gpl)\b", re.I)
    for ln in lines[:20]:
        stripped = ln.strip()
        is_comment = stripped.startswith("#") or stripped.startswith("//")
        if is_comment and lic_kw.search(ln):
            cut += 1
        elif is_comment and cut > 0:
            cut += 1
        else:
            break
    if cut > 2:
        return "".join(lines[cut:])
    return content


def extract_python_imports(content: str) -> list[str]:
    """Extract Python imports using AST for better accuracy than regex."""
    hits: list[str] = []
    try:
        tree = ast.parse(content)
    except SyntaxError:
        return hits

    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            for alias in node.names:
                raw = alias.name
                top = raw.split(".")[0]
                if top and top not in _PY_STDLIB:
                    hits.append(raw)
        elif isinstance(node, ast.ImportFrom):
            module = node.module or ""
            level = getattr(node, "level", 0) or 0
            if level > 0:
                raw = "." * level + module if module else "." * level
                hits.append(raw)
            elif module:
                top = module.split(".")[0]
                if top and top not in _PY_STDLIB:
                    hits.append(module)
    return list(dict.fromkeys(hits))[:15]


def extract_imports(content: str, lang: str) -> list[str]:
    if lang in ("js", "ts"):
        hits: list[str] = []
        for m in _JS_IMPORT_RE.finditer(content):
            val = m.group(1) or m.group(2) or m.group(3) or ""
            if val.startswith("."):
                hits.append(val)
        return list(dict.fromkeys(hits))[:15]
    if lang == "py":
        return extract_python_imports(content)
    return []


def extract_one_liner(content: str, lang: str, filename: str) -> str:
    lines = content.splitlines()
    for line in lines[:12]:
        s = line.strip()
        if not s:
            continue
        for prefix in ("///", "//", "# ", '"""', "'''", "/**", "/*"):
            if s.startswith(prefix):
                text = re.sub(r"^[/*#\"'\s]+", "", s).strip()
                if len(text) > 8 and not re.search(
                    r"(eslint|tslint|prettier|noqa|type-check|type: ignore|type:ignore)",
                    text,
                    re.I,
                ):
                    return text[:100]
    if lang == "json":
        try:
            obj = json.loads(content)
            if isinstance(obj, dict):
                value = obj.get("description") or obj.get("name") or obj.get("title")
                if value:
                    return str(value)[:100]
        except Exception:
            pass
    for line in lines[:25]:
        s = line.strip()
        if not s or any(s.startswith(prefix) for prefix in _NOISE_PREFIXES):
            continue
        return s[:100]
    return filename


def looks_binary(sample: bytes) -> bool:
    return b"\x00" in sample


def hash_file_stream(abs_path: Path, chunk_size: int = 1024 * 1024) -> str:
    h = hashlib.blake2b(digest_size=8)
    with abs_path.open("rb") as f:
        while True:
            chunk = f.read(chunk_size)
            if not chunk:
                break
            h.update(chunk)
    return h.hexdigest()


def read_bytes_prefix(abs_path: Path, limit: int) -> bytes:
    with abs_path.open("rb") as f:
        return f.read(limit)


def read_text_prefix(abs_path: Path, limit: int) -> str:
    data = read_bytes_prefix(abs_path, limit)
    return data.decode("utf-8", errors="replace")


def choose_fence(text: str) -> tuple[str, int]:
    backtick_runs = [len(m.group(0)) for m in re.finditer(r"`+", text)]
    tilde_runs = [len(m.group(0)) for m in re.finditer(r"~+", text)]
    backticks = max(3, (max(backtick_runs) + 1) if backtick_runs else 3)
    tildes = max(3, (max(tilde_runs) + 1) if tilde_runs else 3)
    if tildes < backticks:
        return "~", tildes
    return "`", backticks


def render_file(entry: FileEntry) -> str:
    meta_parts: list[str] = []
    if entry.language:
        meta_parts.append(entry.language)
    meta_parts.append(entry.category)
    meta_parts.append(f"{entry.body_token_count}tok")
    if entry.imports:
        meta_parts.append("← " + ", ".join(entry.imports[:6]))
    meta = " · ".join(meta_parts)

    header = f"──── {posix_rel(entry.rel_path)}  [{meta}]\n"
    if entry.one_liner and entry.one_liner != entry.rel_path.name:
        header += f"# {entry.one_liner}\n"

    fence_char, fence_len = choose_fence(entry.content)
    fence = fence_char * fence_len
    fence_lang = entry.language or ""
    body = f"{fence}{fence_lang}\n{entry.content}\n{fence}"
    return f"\n{header}{body}\n"


def count_chunk_categories(entries: Iterable[FileEntry]) -> dict[str, int]:
    categories: dict[str, int] = {}
    for entry in entries:
        categories[entry.category] = categories.get(entry.category, 0) + 1
    return categories


def build_chunk_header(
    project: str,
    chunk_num: int,
    total_chunks: int,
    total_files: int,
    total_tokens: int,
    chunk_files: int,
    chunk_tokens: int,
    categories: dict[str, int],
    gitignore_active: bool = False,
    readme_summary: str = "",
) -> str:
    cat_str = "  ".join(f"{key}:{value}" for key, value in sorted(categories.items(), key=lambda x: (-x[1], x[0])))
    tiktoken_note = "tiktoken" if TIKTOKEN else "est"
    gitignore_note = "+gitignore" if gitignore_active else ""
    header = (
        f"# {project} · chunk {chunk_num}/{total_chunks}"
        f" · {chunk_files} files · ~{chunk_tokens:,} tokens ({tiktoken_note}{gitignore_note})\n"
        f"# project totals: {total_files} files · ~{total_tokens:,} tokens\n"
        f"# categories: {cat_str}\n"
        f"# each file header: ──── path  [lang · category · Ntok · ← imports]\n"
    )
    if readme_summary and chunk_num == 1:
        header += "#\n# PROJECT CONTEXT (from README):\n"
        for ln in readme_summary.splitlines()[:12]:
            header += f"#   {ln}\n"
    header += f"#{'─' * 76}\n"
    return header


def chunk_total_tokens(
    chunk: list[FileEntry],
    project: str,
    chunk_num: int,
    total_chunks: int,
    total_files: int,
    total_tokens: int,
    gitignore_active: bool,
    readme_summary: str,
) -> int:
    body_tokens = sum(entry.token_count for entry in chunk)
    header_text = build_chunk_header(
        project,
        chunk_num,
        total_chunks,
        total_files,
        total_tokens,
        len(chunk),
        body_tokens,
        count_chunk_categories(chunk),
        gitignore_active=gitignore_active,
        readme_summary=readme_summary,
    )
    return count_tokens(header_text) + body_tokens


def split_entries_by_limit(entries: list[FileEntry], limit: int) -> list[list[FileEntry]]:
    chunks: list[list[FileEntry]] = []
    current: list[FileEntry] = []
    used = 0

    for entry in entries:
        if current and used + entry.token_count > limit:
            chunks.append(current)
            current = []
            used = 0
        current.append(entry)
        used += entry.token_count
    if current:
        chunks.append(current)
    return chunks


def chunk_entries(
    entries: list[FileEntry],
    max_tokens: int,
    project: str,
    gitignore_active: bool,
    readme_summary: str,
) -> list[list[FileEntry]]:
    if not entries:
        return []

    total_files = len(entries)
    total_tokens = sum(entry.token_count for entry in entries)
    chunks = split_entries_by_limit(entries, max_tokens)

    for _ in range(CHUNK_BALANCE_MAX_PASSES):
        total_chunks = len(chunks)
        changed = False
        new_chunks: list[list[FileEntry]] = []

        for idx, chunk in enumerate(chunks, start=1):
            body_tokens = sum(entry.token_count for entry in chunk)
            header_text = build_chunk_header(
                project,
                idx,
                total_chunks,
                total_files,
                total_tokens,
                len(chunk),
                body_tokens,
                count_chunk_categories(chunk),
                gitignore_active=gitignore_active,
                readme_summary=readme_summary,
            )
            header_tokens = count_tokens(header_text)
            if header_tokens >= max_tokens:
                raise ValueError(
                    f"Chunk header alone exceeds max token budget ({header_tokens:,} >= {max_tokens:,})."
                )
            limit = max_tokens - header_tokens
            subchunks = split_entries_by_limit(chunk, limit)
            if len(subchunks) > 1:
                changed = True
            new_chunks.extend(subchunks)

        chunks = new_chunks
        if not changed:
            break

    for idx, chunk in enumerate(chunks, start=1):
        actual_tokens = chunk_total_tokens(
            chunk,
            project,
            idx,
            len(chunks),
            total_files,
            total_tokens,
            gitignore_active,
            readme_summary,
        )
        if actual_tokens > max_tokens and len(chunk) == 1:
            only = chunk[0]
            print(
                f"  ⚠  {posix_rel(only.rel_path)}: rendered block is {actual_tokens:,} tok, "
                f"which exceeds the chunk limit ({max_tokens:,}). Placed in its own chunk."
            )
        elif actual_tokens > max_tokens and len(chunk) > 1:
            raise RuntimeError("Chunk balancing failed to respect the max token budget.")

    return chunks


def build_index(
    project: str,
    entries: list[FileEntry],
    chunks: list[list[FileEntry]],
    tiktoken_available: bool,
    gitignore_active: bool,
    readme_summary: str,
    single: bool = False,
) -> str:
    total_tok = sum(entry.token_count for entry in entries)
    total_bytes = sum(entry.size_bytes for entry in entries)
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    flags: list[str] = []
    if tiktoken_available:
        flags.append("tiktoken-accurate token counts")
    if gitignore_active:
        flags.append("root .gitignore respected")

    lines = [
        f"# {project} — codebase index",
        f"Generated : {now}",
        f"Files     : {len(entries)}",
        f"Tokens    : ~{total_tok:,}  ({', '.join(flags) if flags else 'estimated'})",
        f"Size      : {total_bytes / 1024:.1f} KB",
        "",
        "## Upload order",
        "1. This file (index.md) first — gives AI the full map",
        *(
            [
                f"2. full_codebase.txt — {len(chunks[0])} files, ~"
                f"{chunk_total_tokens(chunks[0], project, 1, 1, len(entries), total_tok, gitignore_active, readme_summary):,} tok"
            ]
            if single
            else [
                f"{i + 2}. chunk_{i + 1:02d}.txt — {len(chunk)} files, ~"
                f"{chunk_total_tokens(chunk, project, i + 1, len(chunks), len(entries), total_tok, gitignore_active, readme_summary):,} tok"
                for i, chunk in enumerate(chunks)
            ]
        ),
        "",
        "---",
        "## File map",
        "",
        f"{'Chunk':>5}  {'Tokens':>6}  {'Cat':<8}  {'Path':<55}  Summary",
        f"{'─' * 5}  {'─' * 6}  {'─' * 8}  {'─' * 55}  {'─' * 35}",
    ]

    by_cat: dict[str, list[tuple[FileEntry, int]]] = {}
    entry_to_chunk = {id(entry): i + 1 for i, chunk in enumerate(chunks) for entry in chunk}
    for entry in entries:
        by_cat.setdefault(entry.category, []).append((entry, entry_to_chunk.get(id(entry), 0)))

    category_order = ["config", "shared", "backend", "frontend", "test", "other"]
    for category in category_order:
        group = by_cat.get(category, [])
        if not group:
            continue
        cat_tok = sum(entry.token_count for entry, _ in group)
        lines.append(f"\n### {category.upper()}  ({len(group)} files · ~{cat_tok:,} tok)")
        for entry, chunk_id in sorted(group, key=lambda x: posix_rel(x[0].rel_path)):
            stub = " [stub]" if entry.skipped else ""
            lines.append(
                f"  {chunk_id:>3}    {entry.token_count:>6,}  {entry.category:<8}  "
                f"{posix_rel(entry.rel_path):<55}  {entry.one_liner[:60]}{stub}"
            )

    dep_lines = [
        f"  {posix_rel(entry.rel_path)}  →  {', '.join(entry.imports)}"
        for entry in entries
        if entry.imports
    ]
    if dep_lines:
        lines += ["", "---", "## Local dependency graph", ""]
        lines += dep_lines

    lines += ["", "---", "## Stats by category", ""]
    for category in category_order:
        group = by_cat.get(category, [])
        if not group:
            continue
        tok = sum(entry.token_count for entry, _ in group)
        kb = sum(entry.size_bytes for entry, _ in group) / 1024
        lines.append(f"  {category:<10}  {len(group):>4} files  ~{tok:>8,} tok  {kb:>7.1f} KB")

    return "\n".join(lines)


# ---------------------------------------------------------------------------
# .gitignore loader
# ---------------------------------------------------------------------------


def load_gitignore(root: Path):
    """Return a root-level pathspec matcher or None."""
    if not PATHSPEC:
        return None
    gitignore = root / ".gitignore"
    if not gitignore.exists():
        return None
    try:
        return pathspec.PathSpec.from_lines("gitwildmatch", gitignore.read_text().splitlines())
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
    allow_structured_text_stub: bool,
) -> Optional[FileEntry]:
    try:
        rel = abs_path.relative_to(root)
    except ValueError:
        return None

    name_lower = abs_path.name.lower()
    ext_lower = abs_path.suffix.lower()

    if name_lower in SKIP_FILES:
        return None
    if ext_lower in SKIP_EXTS:
        return None
    if re.search(r"\.min\.[a-z0-9]+$", name_lower):
        return None

    category = classify(rel)
    if category == "test" and not include_tests:
        return None

    language = detect_language(abs_path)

    try:
        stat = abs_path.stat()
        size_bytes = stat.st_size
    except OSError:
        return None

    try:
        sample = read_bytes_prefix(abs_path, BINARY_SAMPLE_BYTES)
    except OSError:
        return None
    if looks_binary(sample):
        return None

    try:
        raw_hash = hash_file_stream(abs_path)
    except OSError:
        return None

    try:
        if size_bytes > MAX_FILE_BYTES:
            truncated = True
            raw_content = read_text_prefix(abs_path, MAX_FILE_BYTES)
        else:
            truncated = False
            raw_content = abs_path.read_text(encoding="utf-8", errors="replace")
    except OSError:
        return None

    skipped = False
    content = raw_content
    first_lines = "\n".join(raw_content.splitlines()[:5])

    if is_generated(abs_path, first_lines):
        content = f"[GENERATED FILE — {size_bytes:,} bytes, skipped for token efficiency]"
        skipped = True
    elif is_minified(raw_content, language, allow_structured_text_stub=allow_structured_text_stub):
        content = f"[MINIFIED FILE — {size_bytes:,} bytes, skipped for token efficiency]"
        skipped = True
    else:
        if truncated:
            content = f"[TRUNCATED: {size_bytes:,} bytes, showing first {MAX_FILE_BYTES:,} bytes]\n" + raw_content
        content = strip_license_header(content)
        if do_strip_comments and language:
            content = strip_comments(content, language)
        content = normalize_whitespace(content)

    one_liner = extract_one_liner(raw_content, language, abs_path.name)
    imports = extract_imports(raw_content, language) if not skipped else []
    body_token_count = count_tokens(content)

    entry = FileEntry(
        rel_path=rel,
        category=category,
        language=language,
        size_bytes=size_bytes,
        content=content,
        raw_hash=raw_hash,
        body_token_count=body_token_count,
        one_liner=one_liner,
        imports=imports,
        skipped=skipped,
    )
    entry.token_count = count_tokens(render_file(entry))
    return entry


# ---------------------------------------------------------------------------
# Collector
# ---------------------------------------------------------------------------


def find_generated_output_dirs(root: Path) -> set[Path]:
    result: set[Path] = set()
    try:
        top_dirs = [d for d in root.iterdir() if d.is_dir()]
    except PermissionError:
        return result

    for d in top_dirs:
        try:
            inner_dirs = [x for x in d.iterdir() if x.is_dir()]
        except PermissionError:
            inner_dirs = []
        for candidate in [d, *inner_dirs]:
            if (candidate / "manifest.json").exists() and (candidate / "index.md").exists():
                try:
                    data = json.loads((candidate / "manifest.json").read_text())
                    if "total_tokens" in data or "total_files" in data:
                        result.add(candidate.relative_to(root))
                except Exception:
                    pass
    return result


def collect_files(
    root: Path,
    out_dir: Path,
    include_tests: bool,
    do_strip_comments: bool,
    gitignore=None,
    strict: bool = False,
    allow_structured_text_stub: bool = True,
) -> list[FileEntry]:
    try:
        out_dir_rel = out_dir.relative_to(root)
    except ValueError:
        out_dir_rel = None

    generated_dirs = find_generated_output_dirs(root)
    if out_dir_rel:
        generated_dirs.add(out_dir_rel)

    candidates: list[Path] = []
    for dirpath, dirs, files in os.walk(root, topdown=True):
        dp = Path(dirpath)
        try:
            rel_dir = dp.relative_to(root)
        except ValueError:
            continue

        dirs[:] = sorted(
            [
                d
                for d in dirs
                if d.lower() not in SKIP_DIRS
                and not any((rel_dir / d).parts[: len(g.parts)] == g.parts for g in generated_dirs)
                and not (gitignore and gitignore.match_file(posix_rel(rel_dir / d) + "/"))
            ]
        )

        for fname in sorted(files):
            abs_path = dp / fname
            rel = rel_dir / fname
            rel_posix = posix_rel(rel)
            if gitignore and gitignore.match_file(rel_posix):
                continue
            if any(rel.parts[: len(g.parts)] == g.parts for g in generated_dirs):
                continue
            candidates.append(abs_path)

    entries: list[FileEntry] = []
    with ThreadPoolExecutor(max_workers=PARALLEL_WORKERS) as pool:
        futures = {
            pool.submit(read_file, path, root, include_tests, do_strip_comments, allow_structured_text_stub): path for path in candidates
        }
        for fut in as_completed(futures):
            try:
                entry = fut.result()
            except Exception as exc:
                print(f"  ⚠  skipping file (read error): {futures[fut].name}: {exc}")
                continue
            if entry is not None:
                entries.append(entry)

    category_order = {"config": 0, "shared": 1, "backend": 2, "frontend": 3, "test": 4, "other": 5}
    entries.sort(
        key=lambda e: (
            0 if e.rel_path.name.lower() in {"readme.md", "readme.txt", "readme.rst", "readme"} else 1,
            category_order.get(e.category, 9),
            posix_rel(e.rel_path),
        )
    )

    if strict:
        return entries

    deduped: list[FileEntry] = []
    seen_hashes: set[str] = set()
    for entry in entries:
        should_dedup = entry.skipped or (entry.size_bytes <= DEDUP_MIN_BYTES and entry.rel_path.name.lower() in {"index.js", "index.ts", "index.jsx", "index.tsx", "__init__.py"})
        if should_dedup and entry.raw_hash in seen_hashes:
            continue
        if should_dedup:
            seen_hashes.add(entry.raw_hash)
        deduped.append(entry)
    return deduped


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
    strict: bool,
    allow_structured_text_stub: bool,
) -> None:
    out_dir.mkdir(parents=True, exist_ok=True)
    total_tokens = sum(entry.token_count for entry in entries)
    total_files = len(entries)

    readme_summary = ""
    for entry in entries:
        if entry.rel_path.name.lower() in {"readme.md", "readme.txt", "readme.rst", "readme"}:
            lines = [ln for ln in entry.content.splitlines() if ln.strip()][:12]
            readme_summary = "\n".join(lines)
            break

    chunks = (
        [entries]
        if single
        else chunk_entries(entries, max_tokens, project, gitignore_active, readme_summary)
    )

    print(f"\n  Writing {len(chunks)} chunk(s) to {out_dir}/\n")

    for i, chunk in enumerate(chunks, start=1):
        body_tokens = sum(entry.token_count for entry in chunk)
        categories = count_chunk_categories(chunk)
        header_text = build_chunk_header(
            project,
            i,
            len(chunks),
            total_files,
            total_tokens,
            len(chunk),
            body_tokens,
            categories,
            gitignore_active=gitignore_active,
            readme_summary=readme_summary,
        )
        actual_chunk_tokens = count_tokens(header_text) + body_tokens

        fname = "full_codebase.txt" if single else f"chunk_{i:02d}.txt"
        fpath = out_dir / fname

        with fpath.open("w", encoding="utf-8") as f:
            f.write(header_text)
            for entry in chunk:
                f.write(render_file(entry))

        kb = fpath.stat().st_size / 1024
        stubs = sum(1 for entry in chunk if entry.skipped)
        stub_note = f"  ({stubs} stubs)" if stubs else ""
        print(
            f"  ✅  {fname:<28} {len(chunk):>4} files  ~{actual_chunk_tokens:>8,} tok  {kb:>7.1f} KB{stub_note}"
        )

    index_path = out_dir / "index.md"
    index_path.write_text(
        build_index(project, entries, chunks, TIKTOKEN, gitignore_active, readme_summary, single=single),
        encoding="utf-8",
    )
    print(f"  📋  index.md                    {index_path.stat().st_size / 1024:.1f} KB")

    manifest = {
        "strict_mode": strict,
        "allow_structured_text_stub": allow_structured_text_stub,
        "project": project,
        "generated": datetime.now().isoformat(),
        "token_counter": "tiktoken/cl100k_base" if TIKTOKEN else "heuristic",
        "gitignore": gitignore_active,
        "total_files": total_files,
        "total_tokens": total_tokens,
        "chunks": [
            {
                "file": ("full_codebase.txt" if single else f"chunk_{i + 1:02d}.txt"),
                "files": len(chunk),
                "tokens": chunk_total_tokens(
                    chunk,
                    project,
                    i + 1,
                    len(chunks),
                    total_files,
                    total_tokens,
                    gitignore_active,
                    readme_summary,
                ),
            }
            for i, chunk in enumerate(chunks)
        ],
        "files": [
            {
                "path": posix_rel(entry.rel_path),
                "category": entry.category,
                "language": entry.language,
                "tokens": entry.token_count,
                "body_tokens": entry.body_token_count,
                "summary": entry.one_liner,
                "skipped": entry.skipped,
            }
            for entry in entries
        ],
    }
    (out_dir / "manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    print("  📦  manifest.json")

    stubs_total = sum(1 for entry in entries if entry.skipped)
    upload_lines = ["  1. index.md         — full codebase map"]
    if single:
        upload_lines.append("  2. full_codebase.txt")
    else:
        upload_lines.extend(f"  {i + 2}. chunk_{i + 1:02d}.txt" for i in range(len(chunks)))

    print(
        f"""
{'=' * 60}
  Project  : {project}
  Files    : {total_files}  ({stubs_total} stubs)
  Tokens   : ~{total_tokens:,}  ({'tiktoken' if TIKTOKEN else 'estimated'})
  Chunks   : {len(chunks)}
  Out dir  : {out_dir}
  Gitignore: {'yes (root .gitignore via pathspec)' if gitignore_active else 'no (pip install pathspec)'}
  Strict   : {'yes' if strict else 'no'}
  Stub structured text: {'yes' if allow_structured_text_stub else 'no'}
  Tiktoken : {'yes' if TIKTOKEN else 'no  (pip install tiktoken  ← recommended)'}
{'=' * 60}

  UPLOAD ORDER:
{os.linesep.join(upload_lines)}
"""
    )


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Token-optimized AI context builder",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument("--root", type=Path, default=Path("."), help="Project root (default: cwd)")
    parser.add_argument(
        "--out-dir", type=Path, default=Path("ai_context"), help="Output directory (default: ./ai_context)"
    )
    parser.add_argument(
        "--chunk-tokens",
        type=int,
        default=80_000,
        help="Max tokens per chunk (default: 80000; use 180000 for larger contexts)",
    )
    parser.add_argument("--single", action="store_true", help="Single output file")
    parser.add_argument("--include-tests", action="store_true", help="Include test files")
    parser.add_argument(
        "--strip-comments",
        action="store_true",
        help="Conservative, safe comment stripping (currently Python only)",
    )
    parser.add_argument(
        "--max-file-kb",
        type=int,
        default=150,
        help="For larger files, include only the first N KB of text (default: 150)",
    )
    parser.add_argument(
        "--workers",
        type=int,
        default=8,
        help="Parallel reader threads (default: 8)",
    )
    parser.add_argument(
        "--strict",
        action="store_true",
        help="Strict mode: disable content-hash dedup so path-distinct files are always preserved",
    )
    parser.add_argument(
        "--no-structured-text-stub",
        action="store_true",
        help="Never classify long-line JSON/YAML/TOML/SQL/GraphQL/XML/Markdown as minified stubs",
    )
    args = parser.parse_args()

    global MAX_FILE_BYTES, PARALLEL_WORKERS
    MAX_FILE_BYTES = args.max_file_kb * 1024
    PARALLEL_WORKERS = args.workers

    root = args.root.resolve()
    if not root.is_dir():
        print(f"Error: {root} is not a directory.", file=sys.stderr)
        sys.exit(1)

    project = root.name
    out_dir = args.out_dir if args.out_dir.is_absolute() else root / args.out_dir

    gitignore = load_gitignore(root)
    gitignore_active = gitignore is not None

    print(f"\n🔍  Scanning {root} ...")
    if not TIKTOKEN:
        print("    ⚠  tiktoken not found — token counts are estimated (pip install tiktoken)")
    if not PATHSPEC:
        print("    ⚠  pathspec not found — root .gitignore not respected (pip install pathspec)")
    print()

    t0 = time.perf_counter()
    entries = collect_files(
        root,
        out_dir,
        args.include_tests,
        args.strip_comments,
        gitignore,
        strict=args.strict,
        allow_structured_text_stub=not args.no_structured_text_stub,
    )
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
        strict=args.strict,
        allow_structured_text_stub=not args.no_structured_text_stub,
    )


if __name__ == "__main__":
    main()
