#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ClubOS 发版升版脚本。
用法：python bump.py <new_ver>
同步修改：version.json.ver / ts、src/boot.js APP_VER、admin/front/index 三 HTML 的
内联 APP_VER、?v= 查询串，以及 admin.html 右下角静态 verTag 文本。
"""
import re, sys, time

base = "/Users/jckuma/WorkBuddy/2026-08-03-15-24-29/clubos-deploy"
files = [f"{base}/version.json", f"{base}/src/boot.js", f"{base}/admin.html", f"{base}/front.html", f"{base}/index.html"]

def main():
    if len(sys.argv) != 2:
        print("用法: python bump.py <new_ver>", file=sys.stderr)
        sys.exit(1)
    new_ver = sys.argv[1].strip()
    if not new_ver.isdigit():
        print("版本号必须是整数", file=sys.stderr)
        sys.exit(1)
    new_ver = int(new_ver)
    ts = int(time.time())
    updated = []
    for fp in files:
        s = open(fp, encoding="utf-8").read()
        old = s
        # version.json
        if fp.endswith("version.json"):
            s = re.sub(r'"ver":\s*\d+', f'"ver": {new_ver}', s)
            s = re.sub(r'"ts":\s*\d+', f'"ts": {ts}', s)
        else:
            # 内联 APP_VER = X
            s = re.sub(r'APP_VER\s*=\s*\d+', f'APP_VER = {new_ver}', s)
            # ?v=X
            s = re.sub(r'\?v=\d+', f'?v={new_ver}', s)
            # admin.html 静态角标 vX（兜底，boot.js 也会动态覆盖）
            if fp.endswith("admin.html"):
                s = re.sub(r'id="verTag">v\d+', f'id="verTag">v{new_ver}', s)
        if s != old:
            open(fp, "w", encoding="utf-8").write(s)
            updated.append(fp)
            print("updated:", fp)
    if not updated:
        print("no changes")
        sys.exit(0)
    # 基础校验
    for fp in updated:
        if open(fp, encoding="utf-8").read().count("\uFFFD"):
            raise SystemExit(f"encoding corruption in {fp}")
    print(f"OK, bumped to v{new_ver}")

if __name__ == "__main__":
    main()
