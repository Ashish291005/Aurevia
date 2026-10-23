"""Builds the storefront + admin as static files for Hostinger (or any Apache/LiteSpeed host).

    python scripts/build_hostinger.py

Output:
    hostinger-upload/        the files, as they should sit in public_html
    aurevia-hostinger.zip    the same files zipped, for hPanel's "Upload website files"

The backend is not included: it keeps running on Vercel and the uploaded site calls it at
api.<your domain> (add that domain to the Vercel project and a CNAME for it in Hostinger's DNS).
Re-run this and re-upload whenever the storefront or admin code changes.
"""
import os
import shutil
import subprocess
import sys
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "hostinger-upload"
ZIP = ROOT / "aurevia-hostinger.zip"

HTACCESS = """\
# Aurevia: React storefront (single-page app) with the admin panel in /admin.
Options -MultiViews
DirectoryIndex index.html

RewriteEngine On
# Real files and folders (images, scripts, /admin/) are served as they are.
RewriteCond %{REQUEST_FILENAME} -f [OR]
RewriteCond %{REQUEST_FILENAME} -d
RewriteRule ^ - [L]
# Every other path (/shop, /product/..., /checkout) is a storefront page rendered by React.
RewriteRule ^ index.html [L]

<IfModule mod_headers.c>
  # Always check for a new version of the pages; hashed scripts/styles can be cached for a year.
  <FilesMatch "index\\.html$">
    Header set Cache-Control "no-cache"
  </FilesMatch>
  <FilesMatch "\\.(js|css)$">
    Header set Cache-Control "public, max-age=31536000, immutable"
  </FilesMatch>
</IfModule>
"""


def run(cmd, cwd, **env):
    print(f"\n> {cmd}  (in {cwd.name}/)")
    subprocess.run(cmd, cwd=cwd, shell=True, check=True, env={**os.environ, **env})


def main():
    run("npm run build", ROOT / "frontend", REACT_APP_API_SUBDOMAIN="api", GENERATE_SOURCEMAP="false", CI="false")
    run("npm run build", ROOT / "admin", VITE_API_SUBDOMAIN="api")

    shutil.rmtree(OUT, ignore_errors=True)
    shutil.copytree(ROOT / "frontend" / "build", OUT)
    shutil.copytree(ROOT / "admin" / "dist" / "admin", OUT / "admin")
    (OUT / ".htaccess").write_text(HTACCESS, encoding="utf-8", newline="\n")

    ZIP.unlink(missing_ok=True)
    with zipfile.ZipFile(ZIP, "w", zipfile.ZIP_DEFLATED) as z:
        for path in sorted(OUT.rglob("*")):
            if path.is_file():
                z.write(path, path.relative_to(OUT).as_posix())

    files = sum(1 for p in OUT.rglob("*") if p.is_file())
    print(f"\nDone: {files} files in {OUT.name}/ and {ZIP.name} ({ZIP.stat().st_size / 1e6:.1f} MB)")


if __name__ == "__main__":
    try:
        main()
    except subprocess.CalledProcessError as e:
        sys.exit(f"Build failed: {e}")
