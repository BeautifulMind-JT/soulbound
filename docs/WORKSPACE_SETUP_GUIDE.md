# SoulBound — 작업장 세팅 가이드 (초보자용)

이 문서는 코드를 짜기 전에 **공사장(작업 폴더)을 차리는** 단계입니다. 직접 코딩하지 않습니다 — 그건 Cline(Task 1)이 합니다. 우리가 검증한 freeze 번들(설계도 + 계약 + 빌드 배관)을 제자리에 놓고, Cline이 헤매지 않게 규칙 파일을 붙이는 게 전부입니다.

> ⚠️ 중요: 이 번들은 **0C toolchain까지 포함**합니다. 즉 `package.json`, `pnpm-workspace.yaml`,
> `tsconfig.base.json`, `.nvmrc`, `.npmrc`, `scripts/audit.sh`, `packages/core/*` 설정 파일은
> **이미 만들어져 번들 안에 들어 있습니다.** 직접 만들지 마세요. tar를 풀면 나옵니다.

순서: **도구 확인 → 폴더 만들기 → Git 시작 → freeze 번들 풀기 → MANIFEST 검증 → 규칙 파일 붙이기 → GitHub → 작업 브랜치**

맥 기준입니다(윈도우면 명령이 일부 다릅니다).

---

## 0단계 — 터미널 열기

`⌘ + 스페이스` → "터미널" 입력 → 엔터. 한 줄 치고 엔터, 또 한 줄 치고 엔터.

---

## 1단계 — 도구(연장) 확인

```bash
node -v
pnpm -v
git --version
```

기준은 **Node 24 / pnpm 11.1.3**입니다. `command not found`거나 버전이 낮으면 설치하세요.

Node가 없거나 v24 미만이면 nvm으로:

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
```

설치 후 **터미널을 닫았다 다시 열고**:

```bash
nvm install 24
nvm use 24
node -v          # v24.x.x 면 성공
```

pnpm은 corepack으로 켜되, **정확한 패치 버전을 고정**합니다:

```bash
corepack enable
corepack prepare pnpm@11.1.3 --activate
pnpm -v          # 11.1.3 이면 성공
```

> `pnpm@11`은 "11번 박스 아무거나", `pnpm@11.1.3`은 "우리가 검증한 그 박스만" 집어옵니다.
> 번들의 `package.json`이 `pnpm@11.1.3`으로 핀되어 있으니 같은 버전으로 맞추세요.

git이 없으면 `xcode-select --install`.

> 막히면 여기서 멈추고 어떤 명령에서 뭐가 나왔는지 알려주세요. 도구가 안 맞으면 뒤가 다 꼬입니다.

---

## 2단계 — 작업 폴더 만들기

**경로에 한글·공백이 없는 곳**에 만드세요(도구들이 한글/공백에 자주 꼬임).

```bash
mkdir -p ~/Projects/soulbound
cd ~/Projects/soulbound
pwd              # /Users/너의이름/Projects/soulbound
```

앞으로 모든 작업은 이 폴더 안에서 합니다.

---

## 3단계 — Git 시작 + `.gitignore`

```bash
git init
git branch -M main
```

`.gitignore`는 "타임머신에 저장하지 말 것" 목록입니다. **비밀키는 절대 올라가면 안 됩니다.**
`.env*` 전체를 막고 견본만 예외 허용하는 강한 버전을 씁니다:

```bash
cat > .gitignore <<'EOF'
node_modules
.next
.vercel
.turbo
dist
build
coverage

.env*
!.env.example

.DS_Store

supabase/.branches
supabase/.temp
EOF
```

> `.env`만 막으면 `.env.production` 같은 게 새어나갈 수 있습니다. `.env*` 전체 차단 + `!.env.example`(견본만 허용)이 안전합니다.
> 보안 규칙: Supabase service role key를 포함한 어떤 비밀키도 Git에 올리지 마세요 (INV-17).

---

## 4단계 — freeze 번들 풀어 넣기 ⭐

다운로드 방식이 둘입니다. 받은 형태에 맞는 쪽만 하세요.

**(a) `tar.gz`를 직접 받은 경우:**

```bash
cp ~/Downloads/soulbound-freeze-v1.3-FROZEN.tar.gz .
tar xzvf soulbound-freeze-v1.3-FROZEN.tar.gz
rm soulbound-freeze-v1.3-FROZEN.tar.gz
```

**(b) `files (1).zip` 같은 zip 안에 tar가 들어온 경우:**

```bash
mkdir -p ~/Downloads/soulbound-freeze
unzip ~/Downloads/files\ \(1\).zip -d ~/Downloads/soulbound-freeze

cp ~/Downloads/soulbound-freeze/soulbound-freeze-v1.3-FROZEN.tar.gz .
tar xzvf soulbound-freeze-v1.3-FROZEN.tar.gz
rm soulbound-freeze-v1.3-FROZEN.tar.gz
```

풀고 나면 이렇게 보여야 합니다:

```bash
ls -a
```

보여야 정상: `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`, `.nvmrc`, `.npmrc`, `scripts/`, `packages/`, `docs/`

> 이 toolchain 파일들이 보이는 게 정상입니다 — 0C에서 Cowork가 미리 검증해 넣은 것이라
> Cline이 다시 만들 필요가 없습니다.

---

## 5단계 — MANIFEST 검증 ⭐ (stale 사고 방지)

"이게 진짜 최신 번들인지" 1초 확인하는 장치입니다.

```bash
cat docs/MANIFEST.txt
```

위쪽 **GREP ASSERTIONS**의 숫자가 전부 `(expect ...)`와 맞으면 올바른 v1.3-FROZEN 번들입니다. 예:

```text
toolchain files present           : 9/9 (expect 9)
packageManager pin pnpm@11.1.3    : 1 (expect 1)
suiTestnetEnabled in handoff      : 0 (expect 0)
expired in AdmissionStatus        : 1 (expect >=1)
```

**(선택) 무결성까지 확인** — macOS 기본 명령은 `shasum`입니다:

```bash
awk '/^SHA256/{flag=1; next} flag && NF==2 {print}' docs/MANIFEST.txt | shasum -a 256 -c
```

어렵거나 에러가 나면 건너뛰어도 됩니다. 초보자는 `cat docs/MANIFEST.txt`의 GREP ASSERTIONS만 눈으로 확인해도 충분합니다.

---

## 6단계 — Cline 규칙 파일 `.clinerules`

Cline(GLM)이 멋대로 폭주하지 않게 "목줄"을 채웁니다. (이 파일은 번들에 없으니 직접 만듭니다.)

```bash
cat > .clinerules <<'EOF'
You are building SoulBound Phase 1 MVP.
Frozen design contract: docs/architecture/SoulBound_Phase1_MVP_BuildPlan_v1.3-FROZEN.md
Contract handoff: docs/CONTRACT_FREEZE_HANDOFF.md
Toolchain handoff (0C): docs/TOOLCHAIN_FREEZE_HANDOFF.md

TASK DISCIPLINE:
- Implement ONLY the explicitly requested task. Do not proceed to later tasks.

TOOLCHAIN IS PROVIDED (0C) — do not invent it:
- package.json, pnpm-workspace.yaml, tsconfig.base.json, .nvmrc, .npmrc, scripts/audit.sh,
  packages/core/package.json, packages/core/tsconfig.json, packages/core/tsconfig.build.json,
  packages/core/vitest.config.ts already exist and are verified. Do NOT recreate or loosen them.

FROZEN (do not touch unless user says "unfreeze contract"):
- Files under packages/core/src marked "CONTRACT-FROZEN": signatures, types, enums, test assertions.
- Do not .skip or .todo frozen tests.

HARD RULES:
1. React components must NOT call Supabase directly. Flow: component -> hook -> API route -> service -> repository -> adapter.
2. packages/core must NOT import @supabase or any concrete-chain SDK. Pure TypeScript only.
3. Business logic lives in application services, not in routes or components.
4. Every admission status change emits admission_events; every admin action writes audit_logs and requires reasonCode (enum only).
5. In P0 main branch, no real external side effect runs. LedgerPort = NoopLedgerAdapter only.
6. Chain-neutral: do NOT import any concrete-chain SDK (@mysten, aleo, aztec, zcash) on main.
7. direct_messages table is ciphertext-only. Never add plaintext/body_plain columns.
8. Persona Clip: in-app recording only; no upload/preview/retake/edit; absence must never block submit;
   storage access goes through StoragePort, never supabase.storage directly;
   raw media deleted on terminal admission state.
9. Do not implement ICP, Filecoin, IPFS, Arweave. Do not create chat/messages/inbox routes.
10. Do not overbuild.
EOF
```

---

## 7단계 — `.env.example` 견본만 만들기

진짜 키는 안 올리고, "여기에 키가 들어간다"는 견본만 만듭니다. (번들에 없으니 직접 생성.)

```bash
cat > .env.example <<'EOF'
# 공개 가능 (브라우저 노출 OK)
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=

# 서버 전용 — 절대 NEXT_PUBLIC_ 접두사 금지! (INV-17)
SUPABASE_SERVICE_ROLE_KEY=

NEXT_PUBLIC_APP_ENV=local
EOF
```

실제 키는 나중에 `.env.local`에 넣습니다 — `.gitignore`의 `.env*`가 막아주므로 Git에 안 올라갑니다.

---

## 8단계 — 첫 커밋

```bash
git add .
git commit -m "freeze: lock phase1 v1.3 core contracts, tests, and verified toolchain"
```

---

## 9단계 — GitHub 연결 (상황에 따라 분기)

반드시 **private(비공개)** 입니다.

**(A) 완전 신규 프로젝트:**

```bash
gh --version      # 없으면: brew install gh && gh auth login
gh repo create soulbound --private --source=. --remote=origin --push
```

**(B) 기존 `beautiful-mind` repo 안에서 이어가는 경우:**
새 repo를 만들지 마세요. 기존 repo를 clone한 뒤 그 경로에서 진행하거나, 기존 remote에 연결합니다.

```bash
# 예: 기존 repo로 작업하는 경우
git remote add origin git@github.com:BeautifulMind-JT/beautiful-mind.git
git push -u origin main
```

> 신규 클린 스타트면 (A), 기존 프로젝트 연장이면 (B). 둘을 섞지 마세요.

---

## 10단계 — 작업 브랜치

`main`은 안전하게 두고, 작업 가지에서 Task별로 진행합니다.

```bash
git checkout -b phase1-p0-mvp
git push -u origin phase1-p0-mvp
```

---

## 끝났을 때 폴더 모습

```text
~/Projects/soulbound/
  .git/
  .gitignore          (직접 생성)
  .clinerules         (직접 생성 — Cline 목줄)
  .env.example        (직접 생성)
  .npmrc              (번들)
  .nvmrc              (번들)
  package.json        (번들 — 0C)
  pnpm-workspace.yaml (번들 — 0C)
  tsconfig.base.json  (번들 — 0C)
  scripts/audit.sh    (번들 — 0C)
  packages/core/      (번들 — 계약 + 19 red 테스트 + 0C 설정)
  docs/               (번들 — BuildPlan/Handoff/Toolchain/Changeset/MANIFEST)
```

**아직 없어야 정상인 것** (이건 Cline Task 1+ 가 만듭니다):

```text
apps/
supabase/
packages/adapters/
API routes / UI pages / chat·messages·inbox routes
```

> toolchain 파일(package.json, pnpm-workspace.yaml, tsconfig 등)은 "없어야 정상"이 **아닙니다.**
> 0C에서 이미 제공되므로 위 폴더 모습처럼 **있어야 정상**입니다.

---

## 그다음 — Cline Task 1

작업장이 준비되면 `docs/CONTRACT_FREEZE_HANDOFF.md`의 **"Cline Task 1 프롬프트"** 섹션을 그대로 복사해 Cline에게 줍니다. 범위는: 제공된 toolchain·frozen core를 repo에 배치하고 아래가 통과하게만:

```bash
pnpm install
pnpm -r typecheck
pnpm -F @soulbound/core build
bash scripts/audit.sh
```

`pnpm -F @soulbound/core test`는 Task 1 후에도 **19개 RED(NOT_IMPLEMENTED)가 정상**입니다. 초록은 Task 2에서 만듭니다. Cline이 테스트를 수정해서 통과시키면 안 됩니다.
