# save as collect_files.py
from pathlib import Path

def collect_files(root: Path, out_file: Path):
    SKIP_DIRS  = {"node_modules", ".git"}  
    SKIP_FILES = {"package-lock.json", "collect_files.py", "data.json", ".git"}  
    SKIP_EXTS = {".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg"}
    
    with out_file.open("w", encoding="utf-8", errors="replace") as out:
        for path in root.rglob("*"):
            if path.is_dir() and path.name.lower() in SKIP_DIRS:
                continue

            if not path.is_file():
                continue

            if any(part.lower() in SKIP_DIRS for part in path.parts):
                continue

            if path.name.lower() in SKIP_FILES:
                continue

            rel = path.relative_to(root)

            # if it’s an image → only write the name
            if path.suffix.lower() in SKIP_EXTS:
                out.write(f"\n===== IMAGE FILE: {rel} =====\n")
                continue

            # otherwise, dump contents
            out.write(f"\n===== FILE: {rel} =====\n")
            try:
                text = path.read_text(encoding="utf-8", errors="replace")
            except Exception as e:
                text = f"[Could not read file due to: {e}]"
            out.write(text)
            out.write("\n")

if __name__ == "__main__":
    project_root = Path(".").resolve()
    output_path = Path("all_files.txt")
    collect_files(project_root, output_path)
    print(f"Done. Wrote to {output_path}")
