# light-up · Warm Living

Figma의 31개 앱 화면을 HTML · CSS · JavaScript로 구현한 독립 프로젝트입니다.

## 실행
Node.js 20 이상이 필요합니다. 외부 패키지 설치 없이 실행합니다.

```sh
npm run dev
```

Windows PowerShell의 npm.ps1 실행 정책 오류가 있는 경우:

```powershell
npm.cmd run dev
```

[앱 열기](http://localhost:5173)

## 체험
- 왼쪽 메뉴에서 첫 실행 / 홈 제어 / 예약으로 이동.
- 스마트폰 안에서 온보딩, 가입, 데모 로그인, 기기 연결 체험.
- 조명 슬라이더·전원·색온도, 온도 +/−, 예약 생성·편집, 알림 설정.
- 오른쪽 화면 목록으로 전체 31개 화면 열기.
- 작은 화면에서는 목업 위의 세 가지 시작 버튼 사용.

실제 서비스 인증·메일·기기 제어는 수행하지 않습니다. 예시 이메일과 8자 이상의 임의 비밀번호로 로그인할 수 있으며, 비밀번호는 저장하지 않습니다.

## 검증
```sh
npm run check
npm test
```

브라우저 검증은 개발 서버와 9231번 포트에서 원격 디버깅이 켜진 로컬 Chrome을 사용합니다. 테스트 실행 방법은 테스트 파일의 안내를 참고하세요.

디자인과 동작 상세는 [DESIGN.md](./DESIGN.md)를 참고하세요.

## GitHub ? Vercel ??

???: https://github.com/aego12/light-up

Vercel?? ? ???? Import?? vercel.json ??? ?? ?????.
- Framework Preset: Other
- Build Command: npm run build
- Output Directory: dist
- ???? ??: ??? ??

Node ?? ??(server.js)? ????? Vercel?? ?? ?? ??? ?????.

????: /#/home ?? ??? /home ?? ??? ?? ?????. ?? ??? ?? ? ? /#/home?? ??????. Vercel? SPA rewrite? ?? ?? fallback? ?? ??????.

??: npm run check, npm run build, npm run test:refresh
