// ==UserScript==
// @name         크랙 AI 장기요약추가+장기요약압축
// @namespace    https://crack.wrtn.ai/
// @version      2.3.0
// @description  크랙 내부에서 장기기억용 요약 메모리 생성, 2차 압축, 내보내기 (Gemini + DeepSeek V4)
// @author       User
// @match        https://crack.wrtn.ai/*
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @run-at       document-idle
// ==/UserScript==

(function () {
    'use strict';

    const API_BASE = 'https://crack-api.wrtn.ai/crack-gen/v3/chats';

    // ============== 1차 요약 프롬프트 ==============
    const DEFAULT_PROMPT = `# 📔 장기기억 아카이브 요약 프롬프트

## 🎯 목적
채팅 로그를 분석하여 이후 서사가 어긋나지 않도록 **'사건 단위의 독립적 앵커'**를 생성하되, **인물 간의 감정선과 미묘한 상호작용의 질감(Texture)**을 보존한다.

---

## 🧩 출력 단위 및 분리 기준
- **단위**: 출력의 최소 단위는 '사건'이다.
- **분리 필수 조건**: 아래 중 하나라도 해당하면 반드시 **새로운 사건 슬롯**으로 분리
  1. **장소 이동**
  2. **시간대 변화**
  3. **주요 인물 구성 변화**
- **병합 금지**: 주제가 이어지더라도 장소가 바뀌면 정보를 절대 합치지 않는다.
- **소급 금지**: 나중에 발생한 일을 앞선 사건 요약에 미리 포함하지 않는다.

---

## 📋 출력 형식 (강제)

[제목]
- 내용

### 1. 제목 규칙
- **제한**: 공백 포함 **20자 이내**. 조사 및 특수기호 사용 금지.
- **형식**: 유저명 제외, NPC명 필수 포함, 세력명/국가명/소재/핵심행동 등 고유명사 나열
- **예시**: \`[NPC명 연회 독살시도 찻잔]\` (O), \`[NPC명 말다툼 사과 바닐라라떼]\` (O)

### 2. 내용 규칙
- **제한**: 공백 포함 **300자 미만**. **요약체(~함, ~임)** 사용.
- **형식**: \`- \` 으로 시작, 항목 1개 유지.
- **타임라인**: 첫머리에 \`MM/DD 시간대\` 명시.
- **대명사 금지**: '그', '그녀' 대신 정확한 이름 명시.
- **핵심 기록**: 상호작용 연쇄(Flow), 사건 배경(Context), 구체적 양상(How), 미묘한 기류(Mood), 전환점, 구체적 명사

---

## 🚫 기록 원칙
- ❌ 통합 금지, 소설 금지, 뭉개기 금지, 순서 변경 금지, 정보 이동 금지, 대괄호 남발 금지
- ⭕ 팩트 확장 보존, 주체 보존

---

## ⚠️ 오류 조건
- 장소 혼합, 제목 20자 초과, 내용 300자 초과, 순서 오류, 인과 누락, 외국어 출력 시 **출력 오류**`;

    // ============== 2차 압축 프롬프트 ==============
    const COMPRESS_PROMPT = `# 롤플레잉 로그 장기기억 압축정리 지침

## 0. 목적
입력된 장기기억 요약들을 읽고, 이후 LLM이 시맨틱 검색으로 다시 불러오기 좋은 장기기억 항목으로 압축한다.
목표는 감상문이나 장면 묘사가 아니라, 이후 서사 진행에 필요한 사실, 사건, 관계 변화, 설정, 약속, 배신, 사망, 출생, 계약, 조직 변화, 물건, 능력, 장소, 비밀을 빠르게 복원할 수 있는 기억 앵커를 만드는 것이다.
핵심은 "장면별 요약"이 아니라 "검색 가능한 서사 묶음"이다.
한 항목 안에 여러 날짜와 여러 에피소드를 넣어 압축한다.

감정선은 원칙적으로 제외한다. 단, 감정이 이후 행동의 원인으로 확정되었거나 관계 상태를 바꾼 경우에는 사실 형태로만 기록한다.

## 1. 입력 처리 원칙
1. 입력 로그 전체를 시간순으로 읽는다.
2. 장면 단위로 쪼개지 말고, 관련 키워드로 검색 가능한 서사 묶음 단위로 압축한다.
3. 한 항목에는 여러 날짜, 여러 사건, 여러 에피소드가 들어갈 수 있다.
4. 서로 무관한 사건이어도 제목에 각 사건 키워드를 넣어 검색 가능하다면 한 항목에 병합할 수 있다.
5. 단순 일상 대화, 장난, 반복 감정 표현, 분위기 묘사는 기록하지 않는다.
6. 이후 플롯에 영향을 줄 수 있는 정보는 반드시 남긴다.
7. 본문이 180자 이하로 짧아지는 항목은 원칙적으로 만들지 않는다. 인접한 날짜나 관련 사건과 병합한다.
8. 가능한 한 각 항목 본문은 220자에서 300자 사이가 되도록 압축한다.
9. 300자 제한을 초과하지 않는 선에서 핵심 사건을 최대한 많이 담는다.

## 2. 출력 형식
[제목]
# 시대/연도
-날짜 내용
-날짜 내용

다음 항목이 있으면 바로 이어서 같은 형식으로 반복한다.
한 항목에는 날짜 줄이 2개 이상 들어가는 것을 기본으로 한다.

## 3. 제목 규칙
- 대괄호 안 제목은 공백 포함 20자 이내
- 대괄호는 20자 제한에 포함하지 않는다
- 제목은 시맨틱 검색용 키워드 묶음으로 작성한다
- 가능한 한 20자를 최대한 활용한다
- 키워드는 쉼표로 구분한다
- 공백은 사용하지 않는다
- 유저명은 원칙적으로 제목에서 제외한다
- NPC명, 조직명, 장소명, 능력명, 사건명, 물건명을 우선한다
- 감정어는 제목에 쓰지 않는다
- 한 항목 안에 여러 에피소드가 들어갈 경우, 각 에피소드의 검색 키워드를 제목에 함께 넣는다

## 4. 본문 규칙
- 각 항목 본문은 제목 제외 공백 포함 300자 이내
- 본문은 압축 연표체로 쓴다
- 문장은 짧게 쓴다
- 가능하면 "~함", "~됨", "~결정함", "~확보함" 형태를 사용
- 180자 미만 항목은 출력하지 말고 인접 사건과 병합한다
- 300자 제한 안에서는 정보를 과도하게 덜어내지 않는다

## 5. 날짜와 시대 표기
- 날짜는 내용 앞에 반드시 붙인다
- 로그에 시대, 연도, 회귀전후 같은 특이 기점이 있으면 함께 표기
- 날짜가 없는 로그에 임의 날짜를 만들지 않는다

## 6. 압축 우선순위 (300자 초과 시)
1. 감정 표현 2. 분위기 묘사 3. 사소한 행동 묘사 4. 반복 대화 5. 중요하지 않은 장소명 6. 부연 설명 7. 직접 인용 대사

끝까지 남겨야 하는 것: 사망, 출생, 계약, 배신, 조직 변화, 원인과 결과, 인물의 결정, 세계관 설정, 고유명사

## 7. 병합 기준
- 같은 사건 축이 여러 날짜에 걸쳐 진행됨
- 같은 조직, 음모, 계약, 전쟁, 혈통, 추적 등 하나의 주제로 이어짐
- 나중에 검색할 때 같은 키워드로 함께 불러와야 함
- 개별 사건으로 나누면 너무 자잘해져 장기기억 효율이 떨어짐
- 단독 항목으로 만들면 본문이 180자 미만이 됨
- 제목 20자 안에 여러 사건 키워드를 함께 담을 수 있음
- 장소가 바뀌었다는 이유만으로 분리하지 않는다
- 날짜가 바뀌었다는 이유만으로 분리하지 않는다
- 등장인물 구성이 바뀌었다는 이유만으로 분리하지 않는다

## 8. 분리 기준
- 한 항목에 넣으면 300자 제한 안에서 핵심 정보가 사라짐 → 분리
- 제목 20자 안에 주요 키워드를 담을 수 없음 → 분리
- 300자를 넘길 바에야 항목을 2개, 3개로 나눠라

## 9. 문체
- 한국어로만 출력한다
- 해설하지 않는다
- 요약 결과만 출력한다

## 10. 최종 검수 (절대 위반 금지)
- 제목이 공백 포함 20자 초과 → 즉시 재작성
- 본문이 공백 포함 300자 초과 → 즉시 재작성
- 180자 미만 항목 존재 → 인접 사건과 병합
- 300자는 넘을 수 없는 벽이다. 299자 허용, 300자 불허.
- 모든 항목이 검수를 통과할 때까지 출력하지 않는다.`;

    // ============== 유틸 함수 ==============
    function getChatId() {
        const m = location.pathname.match(/\/episodes\/([a-f0-9]+)/);
        return m ? m[1] : null;
    }

    function getToken() {
        const m = document.cookie.match(/(^| )access_token=([^;]+)/);
        return m ? m[2] : null;
    }

    function escapeHtml(s) {
        if (!s) return "";
        const d = document.createElement('div');
        d.textContent = s;
        return d.innerHTML;
    }

    function apiCall(method, path, body) {
        const token = getToken(), chatId = getChatId();
        if (!token || !chatId) {
            alert('인증 정보 또는 채팅 ID를 찾을 수 없습니다.');
            return Promise.resolve(null);
        }
        const opts = {
            method,
            headers: {
                'Authorization': 'Bearer ' + token,
                'Content-Type': 'application/json'
            }
        };
        if (body) opts.body = JSON.stringify(body);
        return fetch(API_BASE + '/' + chatId + path, opts)
            .then(r => {
                if (!r.ok) return r.text().then(t => { console.error('API Error:', r.status, t); return null; });
                return r.text().then(t => t ? JSON.parse(t) : { result: 'SUCCESS' });
            })
            .catch(e => { alert('네트워크 오류: ' + e.message); return null; });
    }

    async function fetchSummaries() {
    let allSummaries = [];
    let cursor = null;
    while (true) {
        let path = '/summaries?limit=20&type=longTerm';
        if (cursor) path += '&cursor=' + encodeURIComponent(cursor);
        let res = await apiCall('GET', path);
        if (!res || !res.data || !res.data.summaries || res.data.summaries.length === 0) break;
        allSummaries = allSummaries.concat(res.data.summaries);
        if (res.data.nextCursor) {
            cursor = res.data.nextCursor;
        } else {
            break;
        }
    }
    return allSummaries;
}

async function fetchRecentMessages(limit) {
    let allMessages = [];
    let cursor = null;
    let requestedLimit = parseInt(limit, 10);
    if (isNaN(requestedLimit)) requestedLimit = 15;
    const isUnlimited = requestedLimit === 0;
    while (true) {
        let fetchLimit = isUnlimited ? 50 : Math.min(requestedLimit - allMessages.length, 50);
        let path = '/messages?limit=' + fetchLimit;
        if (cursor) path += '&cursor=' + encodeURIComponent(cursor);
        let res = await apiCall('GET', path);
        if (!res || !res.data || !res.data.messages || res.data.messages.length === 0) break;
        allMessages = allMessages.concat(res.data.messages);
        if (!isUnlimited && allMessages.length >= requestedLimit) break;
        if (res.data.nextCursor) {
            cursor = res.data.nextCursor;
        } else {
            break;
        }
    }
    if (!isUnlimited) allMessages = allMessages.slice(0, requestedLimit);
    if (allMessages.length === 0) return null;
    let msgs = allMessages.reverse();
    return msgs.map(m => (m.role === 'user' ? 'User' : 'Character') + ': ' + m.content).join('\n\n');
}
   

    async function callAI(provider, config, chatLog, turns, style, isCompress) {
        const promptKey = isCompress ? 'crack_ext_compress_prompt' : 'crack_ext_custom_prompt';
        const defaultPrompt = isCompress ? COMPRESS_PROMPT : DEFAULT_PROMPT;
        const currentPrompt = localStorage.getItem(promptKey) || defaultPrompt;

        const styleInstruction = isCompress ? '' : (style === 'concise'
            ? '\n[간결 모드] 핵심 사건과 전환점만 간결하게 기록한다. 감정 묘사는 최소화한다.'
            : '\n[상세 모드] 감정의 미묘한 변화, 관계 역학의 디테일, 분위기까지 풍부하게 포함한다. 단, 300자 미만은 엄격히 준수한다.');

        const reinforcedPrompt = isCompress
            ? `[압축 대상 장기기억 목록]\n${chatLog}\n\n위 장기기억들을 지침에 따라 압축정리하라.`
            : `[초강력 지시사항]\n제공된 대화는 총 ${turns}턴 분량입니다.\n처음부터 끝까지 모든 흐름을 파악하고, 누락되는 사건 없이 전부 요약하세요.\n${styleInstruction}\n\n[채팅 내역 시작]\n${chatLog}\n[채팅 내역 끝]`;

        if (provider === 'google') {
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${config.model}:generateContent?key=${config.apiKey}`;
            const payload = {
                system_instruction: { parts: [{ text: currentPrompt }] },
                contents: [{ role: "user", parts: [{ text: reinforcedPrompt }] }],
                generationConfig: { temperature: 0.2, topK: 40, topP: 0.8 }
            };
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (!response.ok) { const err = await response.json(); throw new Error(err.error?.message || 'Gemini API 에러'); }
            const data = await response.json();
            return data.candidates[0].content.parts[0].text;
        }

        if (provider === 'deepseek') {
            const payload = {
                model: config.model,
                messages: [
                    { role: "system", content: currentPrompt },
                    { role: "user", content: reinforcedPrompt }
                ],
                temperature: 0.2,
                top_p: 0.8,
                max_tokens: 8192
            };
            const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + config.apiKey },
                body: JSON.stringify(payload)
            });
            if (!response.ok) { const err = await response.json(); throw new Error(err.error?.message || 'DeepSeek API 에러'); }
            const data = await response.json();
            return data.choices[0].message.content;
        }

        if (provider === 'firebase') {
            const firebaseConfig = parseFirebaseConfig(config.firebaseScript);
            if (!firebaseConfig) throw new Error("Firebase 스크립트 형식이 올바르지 않습니다.");
            const { initializeApp } = await import("https://www.gstatic.com/firebasejs/12.8.0/firebase-app.js");
            const { getAI, getGenerativeModel, VertexAIBackend, HarmBlockThreshold, HarmCategory } = await import("https://www.gstatic.com/firebasejs/12.8.0/firebase-ai.js");
            const app = initializeApp(firebaseConfig, "crack-ext-" + Date.now());
            const ai = getAI(app, { backend: new VertexAIBackend('global') });
            const safetySettings = [
                { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.OFF },
                { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.OFF },
                { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.OFF },
                { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.OFF }
            ];
            const modelWithSys = getGenerativeModel(ai, {
                model: config.model,
                systemInstruction: currentPrompt,
                safetySettings,
                generationConfig: { temperature: 0.2, topK: 40, topP: 0.8 }
            });
            const result = await modelWithSys.generateContent(reinforcedPrompt);
            const response = await result.response;
            return response.text();
        }
        throw new Error('알 수 없는 API 제공자');
    }

    function parseFirebaseConfig(scriptStr) {
        try {
            const match = scriptStr.match(/firebaseConfig\s*=\s*(\{[\s\S]*?\});/);
            if (match && match[1]) return new Function("return " + match[1])();
            if (scriptStr.includes("apiKey")) {
                const startIndex = scriptStr.indexOf("firebaseConfig = {");
                if (startIndex !== -1) {
                    const endIndex = scriptStr.indexOf("};", startIndex);
                    if (endIndex !== -1) return new Function("return " + scriptStr.substring(startIndex + 18, endIndex + 1))();
                }
            }
        } catch(e) {}
        return null;
    }

    // ============== 내보내기 ==============
    function exportAsTxt(cards) {
        let content = '';
        cards.forEach(card => { content += '[' + card.title + ']\n- ' + card.summary + '\n\n'; });
        return content.trim();
    }

    function exportAsJson(cards) {
        return JSON.stringify({
            exportedAt: new Date().toISOString(),
            totalCards: cards.length,
            summaries: cards.map(card => ({ title: card.title, summary: card.summary }))
        }, null, 2);
    }

    function exportAsMarkdown(cards) {
        let content = '# 📔 장기기억 아카이브 요약\n\n';
        content += '> 내보낸 날짜: ' + new Date().toLocaleString('ko-KR') + '\n';
        content += '> 총 ' + cards.length + '개의 사건 요약\n\n---\n\n';
        cards.forEach((card, index) => {
            content += '## ' + (index + 1) + '. ' + card.title + '\n\n' + card.summary + '\n\n';
            if (index < cards.length - 1) content += '---\n\n';
        });
        return content;
    }

    function downloadFile(content, filename, mimeType) {
        const blob = new Blob(['\uFEFF' + content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = filename;
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    // ============== 스타일 ==============
    function injectAiStyles() {
        if (document.getElementById('crack-ext-ai-css')) return;
        const s = document.createElement('style');
        s.id = 'crack-ext-ai-css';
        s.textContent = `
.crack-ext-ai-overlay{background:rgba(0,0,0,.5);z-index:100000;position:fixed;inset:0;display:flex;align-items:center;justify-content:center;pointer-events:auto!important}
.crack-ext-ai-modal{background:#fff!important;border-radius:16px;padding:24px;width:680px;max-width:92vw;max-height:92vh;overflow-y:auto;box-shadow:0 8px 40px rgba(0,0,0,.2);pointer-events:auto!important;color:#222!important}
.crack-ext-ai-modal-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:16px}
.crack-ext-ai-modal-header h3{margin:0;color:#222!important;font-size:17px;font-weight:700}
.crack-ext-ai-modal label{display:flex;font-size:13px;font-weight:600;margin-bottom:4px;color:#333!important;align-items:center;justify-content:space-between}
.crack-ext-ai-modal input,.crack-ext-ai-modal textarea,.crack-ext-ai-modal select{width:100%;padding:8px 10px;border:1px solid #ddd!important;border-radius:8px;font-size:13px;box-sizing:border-box;font-family:inherit;pointer-events:auto!important;background-color:#fff!important;color:#222!important}
.crack-ext-ai-modal-btns{display:flex;gap:8px;justify-content:space-between;align-items:flex-end;margin-top:16px}
.crack-ext-ai-mbtn{padding:8px 18px;border-radius:8px;border:1px solid #ddd!important;background:#fff!important;color:#222!important;cursor:pointer;font-size:13px;font-weight:600;transition:background 0.2s}
.crack-ext-ai-mbtn:hover{background:#f5f5f5!important}
.crack-ext-ai-mbtn-p{background:#222!important;color:#fff!important;border-color:#222!important}
.crack-ext-ai-mbtn-p:hover{background:#444!important}
.crack-ext-ai-mbtn-p:disabled,.crack-ext-ai-mbtn:disabled{background:#ccc!important;border-color:#ccc!important;color:#666!important;cursor:not-allowed}
.crack-ext-ai-mbtn-save{background:#4CAF50!important;color:#fff!important;border-color:#4CAF50!important;font-size:11px!important;padding:6px 12px!important}
.crack-flex-ai-row{display:flex;gap:10px;margin-bottom:12px;flex-wrap:wrap}
.crack-flex-ai-row .fg{flex:1;min-width:100px}
#ce-ai-preview-container{margin-top:10px}
#ce-ai-card-nav{display:flex;align-items:center;justify-content:center;gap:10px;margin-bottom:6px;font-size:12px;font-weight:bold}
#ce-ai-card-nav button{cursor:pointer;background:#f0f0f0;border:1px solid #ddd;border-radius:6px;padding:4px 10px;font-size:11px;color:#333}
#ce-ai-card-nav button:hover{background:#e4e4e4}
.crack-ext-session-card{background:#f9f9f9!important;border:1px solid #eee!important;border-radius:8px;padding:10px;font-size:12px;margin-bottom:6px}
.crack-ext-session-title{font-weight:bold;margin-bottom:6px;display:flex;justify-content:space-between;align-items:center}
.crack-ext-session-content{color:#555!important;line-height:1.4;white-space:pre-wrap;word-break:break-all}
.crack-ext-char-count{font-size:10px;font-weight:normal;color:#777}
.crack-ext-count-error{color:#e74c3c!important;font-weight:bold}
.crack-ext-header-ai-btn{display:inline-flex;align-items:center;justify-content:center;padding:0 10px;height:32px;border-radius:6px;background:linear-gradient(135deg,#6e8efb,#a777e3)!important;color:white!important;font-weight:600;font-size:12px;border:none!important;cursor:pointer;white-space:nowrap!important}
.crack-ext-export-btn{padding:5px 10px;border-radius:6px;border:1px solid #ddd;background:#fff;color:#333;cursor:pointer;font-size:11px;transition:background 0.2s}
.crack-ext-export-btn:hover{background:#f0f0f0}
.crack-ext-compress-list{max-height:250px;overflow-y:auto;border:1px solid #ddd;border-radius:8px;padding:8px;margin-top:4px}
.crack-ext-compress-item{display:flex;align-items:flex-start;gap:8px;padding:6px 4px;border-bottom:1px solid #eee;font-size:12px;cursor:pointer}
.crack-ext-compress-item:hover{background:#f5f5f5}
.crack-ext-compress-item input[type=checkbox]{margin-top:2px;width:auto!important;min-width:auto!important}
.crack-ext-compress-item .item-title{font-weight:600;color:#333}
.crack-ext-compress-item .item-summary{color:#777;font-size:11px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:400px}
.crack-ext-compress-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:4px}
.crack-ext-compress-header span{font-size:12px;color:#666}
.crack-ext-badge{display:inline-block;padding:2px 8px;border-radius:10px;font-size:10px;font-weight:600;margin-left:4px}
.crack-ext-badge-compress{background:#fef3c7;color:#92400e}
.crack-ext-prompt-save-row{display:flex;align-items:center;gap:8px;margin-top:4px}

body[data-theme="dark"] .crack-ext-ai-modal{background:#242321!important;color:#F0EFEB!important}
body[data-theme="dark"] .crack-ext-ai-modal-header h3,body[data-theme="dark"] .crack-ext-ai-modal label{color:#F0EFEB!important}
body[data-theme="dark"] .crack-ext-ai-modal input,body[data-theme="dark"] .crack-ext-ai-modal textarea,body[data-theme="dark"] .crack-ext-ai-modal select{background:#141413!important;color:#F0EFEB!important;border:1px solid #42413D!important}
body[data-theme="dark"] .crack-ext-ai-modal select option{background:#141413!important;color:#F0EFEB!important}
body[data-theme="dark"] #ce-ai-card-nav button{background:#2E2D2B!important;color:#F0EFEB!important;border:1px solid #42413D!important}
body[data-theme="dark"] .crack-ext-session-card{background:#1a1918!important;border:1px solid #42413D!important}
body[data-theme="dark"] .crack-ext-session-content{color:#ccc!important}
body[data-theme="dark"] .crack-ext-ai-mbtn{background:#2E2D2B!important;color:#F0EFEB!important;border:1px solid #42413D!important}
body[data-theme="dark"] .crack-ext-ai-mbtn-p{background:#F0EFEB!important;color:#1A1918!important}
body[data-theme="dark"] .crack-ext-count-error{color:#ff6b6b!important}
body[data-theme="dark"] .crack-ext-export-btn{background:#2E2D2B!important;color:#F0EFEB!important;border:1px solid #42413D!important}
body[data-theme="dark"] .crack-ext-compress-list{border-color:#42413D}
body[data-theme="dark"] .crack-ext-compress-item:hover{background:#2E2D2B}
body[data-theme="dark"] .crack-ext-compress-item .item-title{color:#F0EFEB}
body[data-theme="dark"] .crack-ext-compress-item .item-summary{color:#999}
body[data-theme="dark"] .crack-ext-compress-header span{color:#999}
body[data-theme="dark"] .crack-ext-badge-compress{background:#3b2e0a;color:#fcd34d}
body[data-theme="dark"] .crack-ext-ai-mbtn-save{background:#388E3C!important}`;
        document.head.appendChild(s);
    }

    function showToast(message) {
        var old = document.getElementById('crack-ext-toast');
        if (old) old.remove();
        var toast = document.createElement('div');
        toast.id = 'crack-ext-toast';
        toast.style.cssText = 'position:fixed;top:20px;left:50%;transform:translateX(-50%) translateY(-10px);z-index:999999999;background:#1a1a1a;color:#fff;padding:12px 24px;border-radius:10px;font-size:14px;font-weight:500;box-shadow:0 4px 20px rgba(0,0,0,0.25);transition:opacity 0.3s,transform 0.3s;';
        toast.textContent = message;
        document.body.appendChild(toast);
        requestAnimationFrame(() => { toast.style.opacity = '1'; toast.style.transform = 'translateX(-50%) translateY(0)'; });
        setTimeout(() => { toast.style.opacity = '0'; toast.style.transform = 'translateX(-50%) translateY(-10px)'; setTimeout(() => toast.remove(), 300); }, 3000);
    }

    function refreshCurrentTab(dialog) {
        var btns = dialog.querySelectorAll('button'), activeBtn = null, otherBtn = null;
        for (var i = 0; i < btns.length; i++) {
            var txt = btns[i].textContent.trim();
            if (txt === '단기 기억' || txt === '장기 기억') {
                var bg = getComputedStyle(btns[i]).backgroundColor;
                var m = bg.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)\)/);
                if (m && (parseInt(m[1]) + parseInt(m[2]) + parseInt(m[3])) / 3 < 128) activeBtn = btns[i];
                else if (txt === '장기 기억') otherBtn = btns[i];
            }
        }
        if (!activeBtn) return;
        if (otherBtn) { otherBtn.click(); setTimeout(() => { activeBtn.click(); }, 150); }
        else { activeBtn.click(); }
    }

    function updateModelOptions(provider) {
        var sel = document.getElementById('ce-ai-model');
        if (!sel) return;
        var savedModel = localStorage.getItem('crack_ext_' + provider + '_model') || '';
        sel.innerHTML = '';
        var models = [];
        if (provider === 'google') {
            models = [
                {v:'gemini-3.5-flash', t:'3.5 Flash'},
                {v:'gemini-3.1-pro-preview', t:'3.1 Pro'},
                {v:'gemini-3.1-flash-lite', t:'3.1 Flash-Lite'},
                {v:'gemini-3-pro-preview', t:'3.0 Pro'},
                {v:'gemini-3-flash-preview', t:'3.0 Flash'},
                {v:'gemini-2.5-pro', t:'2.5 Pro'}
            ];
            if (!savedModel) savedModel = 'gemini-3.1-pro-preview';
        } else if (provider === 'deepseek') {
            models = [
                {v:'deepseek-v4-pro', t:'V4 Pro'},
                {v:'deepseek-v4-flash', t:'V4 Flash'}
            ];
            if (!savedModel) savedModel = 'deepseek-v4-flash';
        } else if (provider === 'firebase') {
            models = [
                {v:'gemini-3.1-pro-preview', t:'3.1 Pro'},
                {v:'gemini-3.5-flash', t:'3.5 Flash'},
                {v:'gemini-2.5-pro', t:'2.5 Pro'}
            ];
            if (!savedModel) savedModel = 'gemini-3.1-pro-preview';
        }
        models.forEach(m => {
            var opt = document.createElement('option');
            opt.value = m.v; opt.textContent = m.t;
            if (m.v === savedModel) opt.selected = true;
            sel.appendChild(opt);
        });
    }

    // ============== 2차 압축 모달 ==============
    function showCompressModal() {
        var overlay = document.createElement('div');
        overlay.className = 'crack-ext-ai-overlay';

        var html = '<div class="crack-ext-ai-modal" style="width:600px;">';
        html += '<div class="crack-ext-ai-modal-header"><h3>📦 장기기억 2차 압축</h3><span class="crack-ext-badge crack-ext-badge-compress">검색형 압축</span></div>';
        html += '<div class="crack-ext-compress-header"><span>압축할 장기기억을 선택하세요 (여러 개 선택 가능)</span><button class="crack-ext-ai-mbtn" id="ce-compress-select-all" style="font-size:11px;padding:4px 10px;">전체 선택</button></div>';
        html += '<div class="crack-ext-compress-list" id="ce-compress-list"><div style="text-align:center;padding:20px;color:#999;">불러오는 중...</div></div>';
        html += '<div style="margin-top:8px;font-size:11px;color:#888;">💡 선택한 항목들을 2차 압축 프롬프트로 병합·압축합니다. 원본은 유지됩니다.</div>';
        html += '<div class="crack-ext-ai-modal-btns">';
        html += '<div><button class="crack-ext-ai-mbtn" id="ce-compress-cancel">취소</button></div>';
        html += '<div><button class="crack-ext-ai-mbtn crack-ext-ai-mbtn-p" id="ce-compress-start" disabled>압축 생성</button></div>';
        html += '</div></div>';

        overlay.innerHTML = html;
        document.body.appendChild(overlay);

        var listContainer = overlay.querySelector('#ce-compress-list');
        var btnStart = overlay.querySelector('#ce-compress-start');
        var btnSelectAll = overlay.querySelector('#ce-compress-select-all');
        var btnCancel = overlay.querySelector('#ce-compress-cancel');
        var allSummaries = [];
        var allSelected = false;

        btnCancel.onclick = () => overlay.remove();
        overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });

        fetchSummaries().then(summaries => {
            allSummaries = summaries;
            if (!allSummaries || allSummaries.length === 0) {
                listContainer.innerHTML = '<div style="text-align:center;padding:20px;color:#999;">장기기억이 없습니다.</div>';
                return;
            }
            renderList();
        });

        function renderList() {
            listContainer.innerHTML = '';
            allSummaries.forEach((s, i) => {
                if (!s.title || s.title === 'undefined') return;
                if (!s.summary || s.summary.trim() === '') return;
                if (/^[가-힣]{2,4}\s*\(.*\)$/.test(s.title) && s.title.length < 15) return;

                var div = document.createElement('div');
                div.className = 'crack-ext-compress-item';
                div.innerHTML = '<input type="checkbox" data-index="' + i + '"><div style="flex:1;"><div class="item-title">[' + escapeHtml(s.title) + ']</div><div class="item-summary">' + escapeHtml(s.summary || '') + '</div></div>';
                div.addEventListener('click', function(e) {
                    if (e.target.tagName === 'INPUT') return;
                    var cb = div.querySelector('input');
                    cb.checked = !cb.checked;
                    updateButton();
                });
                listContainer.appendChild(div);
            });
            updateButton();
        }

        function getSelected() {
            var checked = [];
            listContainer.querySelectorAll('input:checked').forEach(cb => {
                var idx = parseInt(cb.dataset.index);
                if (!isNaN(idx) && allSummaries[idx]) checked.push(allSummaries[idx]);
            });
            return checked;
        }

        function updateButton() {
            btnStart.disabled = getSelected().length === 0;
            btnStart.textContent = '압축 생성 (' + getSelected().length + '개 선택)';
        }

        listContainer.addEventListener('change', updateButton);

        btnSelectAll.onclick = () => {
            allSelected = !allSelected;
            listContainer.querySelectorAll('input').forEach(cb => { cb.checked = allSelected; });
            btnSelectAll.textContent = allSelected ? '전체 해제' : '전체 선택';
            updateButton();
        };

        btnStart.onclick = async () => {
            var selected = getSelected();
            if (selected.length === 0) return alert('압축할 항목을 선택해주세요.');

            var combinedText = selected.map(s => '[' + s.title + ']\n' + (s.summary || '') + '\n').join('\n---\n\n');
// 메인 모달에서 선택된 모델 즉시 저장
var mainModel = document.getElementById('ce-ai-model');
var mainProvider = document.getElementById('ce-ai-provider');
if (mainModel && mainProvider) {
    localStorage.setItem('crack_ext_api_provider', mainProvider.value);
    localStorage.setItem('crack_ext_' + mainProvider.value + '_model', mainModel.value);
}
            var provider = localStorage.getItem('crack_ext_api_provider') || 'google';
            var model = localStorage.getItem('crack_ext_' + provider + '_model') || 'gemini-3.1-pro-preview';
            var apiKey = provider === 'deepseek' ? (localStorage.getItem('crack_ext_deepseek_key') || '') : (localStorage.getItem('crack_ext_gemini_key') || '');
            var firebaseScript = localStorage.getItem('crack_ext_firebase_script') || '';

            btnStart.disabled = true;
            btnStart.textContent = '압축 중...';

            try {
                var config = { apiKey, model, firebaseScript };
                var result = await callAI(provider, config, combinedText, 0, 'concise', true);
                overlay.remove();
                showMainModal(result, true);
            } catch (err) {
                alert('압축 중 오류: ' + err.message);
                btnStart.disabled = false;
                btnStart.textContent = '압축 생성';
            }
        };
    }

    // ============== 메인 모달 ==============
    function showMainModal(prefillText, isCompressResult) {
        var overlay = document.createElement('div');
        overlay.className = 'crack-ext-ai-overlay';

        var savedProvider = localStorage.getItem('crack_ext_api_provider') || 'google';
        var savedGoogleKey = localStorage.getItem('crack_ext_gemini_key') || '';
        var savedDeepSeekKey = localStorage.getItem('crack_ext_deepseek_key') || '';
        var savedFirebaseScript = localStorage.getItem('crack_ext_firebase_script') || '';
        var savedTurns = localStorage.getItem('crack_ext_turn_count') || '15';
        var savedStyle = localStorage.getItem('crack_ext_summary_style') || 'concise';
        var currentKey = savedProvider === 'deepseek' ? savedDeepSeekKey : savedGoogleKey;

        var isPromptMode = false;
        var tempResultContent = "";
        var parsedCards = [];
        var currentCardIndex = 0;
        var currentPromptMode = 'main';

        var html = '<div class="crack-ext-ai-modal">';
        html += '<div class="crack-ext-ai-modal-header"><h3>✨ AI 요약 / 장기 기억 추가' + (isCompressResult ? ' <span class="crack-ext-badge crack-ext-badge-compress">2차 압축 결과</span>' : '') + '</h3></div>';

        html += '<div class="crack-flex-ai-row" id="ce-ai-top-settings">';
        html += '<div class="fg" style="flex:1.2;"><label>API</label><select id="ce-ai-provider"><option value="google"' + (savedProvider==='google'?' selected':'') + '>Google</option><option value="deepseek"' + (savedProvider==='deepseek'?' selected':'') + '>DeepSeek</option><option value="firebase"' + (savedProvider==='firebase'?' selected':'') + '>Firebase</option></select></div>';
        html += '<div class="fg" id="ce-ai-key-wrap" style="flex:2;' + (savedProvider==='firebase'?'display:none':'') + '"><label>API Key</label><input type="password" id="ce-ai-key" value="' + escapeHtml(currentKey) + '"></div>';
        html += '<div class="fg" id="ce-ai-firebase-wrap" style="flex:2;' + (savedProvider==='firebase'?'':'display:none') + '"><label>Firebase Script</label><input type="text" id="ce-ai-firebase-script" value="' + escapeHtml(savedFirebaseScript) + '"></div>';
        html += '<div class="fg" style="flex:1.5;"><label>모델</label><select id="ce-ai-model"></select></div>';
        html += '<div class="fg" style="flex:0.8;"><label>턴 수</label><input type="number" id="ce-ai-turns" value="' + escapeHtml(savedTurns) + '" min="0"></div>';
        html += '</div>';

        html += '<div class="crack-flex-ai-row">';
        html += '<div class="fg" style="flex:1;"><label>요약 스타일</label><select id="ce-ai-style"><option value="concise"' + (savedStyle==='concise'?' selected':'') + '>간결</option><option value="detailed"' + (savedStyle==='detailed'?' selected':'') + '>상세</option></select></div>';
        html += '<div class="fg" style="flex:2;display:flex;align-items:flex-end;gap:4px;">';
        html += '<button class="crack-ext-export-btn" data-export="txt">TXT</button>';
        html += '<button class="crack-ext-export-btn" data-export="json">JSON</button>';
        html += '<button class="crack-ext-export-btn" data-export="md">Markdown</button>';
        html += '<span style="font-size:11px;color:#888;margin-left:8px;">내보내기</span>';
        html += '</div>';
        html += '</div>';

        html += '<div class="fg"><label style="display:flex;justify-content:space-between;">';
        html += '<span>생성 결과</span>';
        html += '<div style="display:flex;align-items:center;gap:8px;">';
        html += '<span id="ce-ai-selection-counter" style="color:#a777e3;font-size:11px;"></span>';
        html += '<select id="ce-ai-prompt-select" style="width:auto!important;font-size:11px;padding:4px 8px;"><option value="main">1차 요약</option><option value="compress">2차 압축</option></select>';
        html += '<button id="ce-ai-toggle-prompt" style="font-size:11px;background:none;border:1px solid #ddd;padding:4px 8px;border-radius:4px;cursor:pointer;">프롬프트 편집</button>';
        html += '<button id="ce-ai-save-prompt" class="crack-ext-ai-mbtn crack-ext-ai-mbtn-save" style="display:none;">💾 저장</button>';
        html += '</div></label>';
        html += '<textarea id="ce-ai-result" rows="6" placeholder="생성 버튼을 누르면 요약 결과가 나옵니다.">' + (prefillText ? escapeHtml(prefillText) : '') + '</textarea>';
        html += '<div id="ce-ai-preview-container">';
        html += '<div id="ce-ai-card-nav" style="display:none;"><button id="ce-ai-card-prev">이전</button><span id="ce-ai-card-page">1/1</span><button id="ce-ai-card-next">다음</button></div>';
        html += '<div id="ce-ai-preview-cards"></div>';
        html += '</div></div>';

        html += '<div class="crack-ext-ai-modal-btns">';
        html += '<div style="display:flex;gap:8px;"><button class="crack-ext-ai-mbtn" id="ce-ai-generate">요약 생성</button><button class="crack-ext-ai-mbtn" id="ce-ai-compress-btn" style="background:#fef3c7!important;color:#92400e!important;border-color:#fcd34d!important;">📦 2차 압축</button></div>';
        html += '<div style="display:flex;gap:8px;"><button class="crack-ext-ai-mbtn" id="ce-ai-cancel">취소</button><button class="crack-ext-ai-mbtn crack-ext-ai-mbtn-p" id="ce-ai-save">추가하기</button></div>';
        html += '</div></div>';

        overlay.innerHTML = html;
        document.body.appendChild(overlay);

        var txtResult = overlay.querySelector('#ce-ai-result');
        var selCounter = overlay.querySelector('#ce-ai-selection-counter');
        var previewCards = overlay.querySelector('#ce-ai-preview-cards');
        var cardNav = overlay.querySelector('#ce-ai-card-nav');
        var spanCardPage = overlay.querySelector('#ce-ai-card-page');
        var btnCardPrev = overlay.querySelector('#ce-ai-card-prev');
        var btnCardNext = overlay.querySelector('#ce-ai-card-next');
        var btnSave = overlay.querySelector('#ce-ai-save');
        var btnGen = overlay.querySelector('#ce-ai-generate');
        var btnCompress = overlay.querySelector('#ce-ai-compress-btn');
        var btnCancel = overlay.querySelector('#ce-ai-cancel');
        var btnTogglePrompt = overlay.querySelector('#ce-ai-toggle-prompt');
        var btnSavePrompt = overlay.querySelector('#ce-ai-save-prompt');
        var selPrompt = overlay.querySelector('#ce-ai-prompt-select');
        var selProvider = overlay.querySelector('#ce-ai-provider');
        var selModel = overlay.querySelector('#ce-ai-model');
        var selStyle = overlay.querySelector('#ce-ai-style');
        var inputKey = overlay.querySelector('#ce-ai-key');
        var inputFirebase = overlay.querySelector('#ce-ai-firebase-script');
        var inputTurns = overlay.querySelector('#ce-ai-turns');
        var keyWrap = overlay.querySelector('#ce-ai-key-wrap');
        var firebaseWrap = overlay.querySelector('#ce-ai-firebase-wrap');

        updateModelOptions(savedProvider);

        // === API Key 자동 저장 ===
              function saveKey() {
            var p = selProvider.value;
            if (p === 'deepseek') localStorage.setItem('crack_ext_deepseek_key', inputKey.value.trim());
            else if (p === 'google') localStorage.setItem('crack_ext_gemini_key', inputKey.value.trim());
        }
        inputKey.addEventListener('input', saveKey);
        inputKey.addEventListener('change', saveKey);
        inputKey.addEventListener('paste', function() {
            setTimeout(saveKey, 100);
        });

        selProvider.onchange = function() {
            var p = selProvider.value;
            if (p === 'firebase') { keyWrap.style.display = 'none'; firebaseWrap.style.display = 'block'; }
            else {
                keyWrap.style.display = 'block'; firebaseWrap.style.display = 'none';
                inputKey.value = p === 'deepseek' ? (localStorage.getItem('crack_ext_deepseek_key') || '') : (localStorage.getItem('crack_ext_gemini_key') || '');
            }
            updateModelOptions(p);
        };
                selModel.addEventListener('change', function() {
            localStorage.setItem('crack_ext_' + selProvider.value + '_model', selModel.value);
        });

        selPrompt.onchange = function() {
            currentPromptMode = selPrompt.value;
            btnTogglePrompt.textContent = '프롬프트 편집';
            isPromptMode = false;
            btnSavePrompt.style.display = 'none';
            txtResult.value = tempResultContent || txtResult.value;
            overlay.querySelector('#ce-ai-top-settings').style.display = 'flex';
            btnSave.style.display = 'block'; btnGen.style.display = 'block'; btnCompress.style.display = 'block';
            updatePreviewCards();
        };

        // === 프롬프트 편집 + 저장 ===
        btnTogglePrompt.onclick = function(e) {
            e.stopPropagation(); e.preventDefault();
            isPromptMode = !isPromptMode;
            if (isPromptMode) {
                tempResultContent = txtResult.value;
                var promptKey = currentPromptMode === 'compress' ? 'crack_ext_compress_prompt' : 'crack_ext_custom_prompt';
                var defaultP = currentPromptMode === 'compress' ? COMPRESS_PROMPT : DEFAULT_PROMPT;
                txtResult.value = localStorage.getItem(promptKey) || defaultP;
                btnTogglePrompt.textContent = '돌아가기';
                btnSavePrompt.style.display = 'inline-block';
                overlay.querySelector('#ce-ai-top-settings').style.display = 'none';
                btnSave.style.display = 'none'; btnGen.style.display = 'none'; btnCompress.style.display = 'none';
                updatePreviewCards();
            } else {
                txtResult.value = tempResultContent;
                btnTogglePrompt.textContent = '프롬프트 편집';
                btnSavePrompt.style.display = 'none';
                overlay.querySelector('#ce-ai-top-settings').style.display = 'flex';
                btnSave.style.display = 'block'; btnGen.style.display = 'block'; btnCompress.style.display = 'block';
                updatePreviewCards();
            }
        };

        btnSavePrompt.onclick = function(e) {
            e.stopPropagation(); e.preventDefault();
            var promptKey = currentPromptMode === 'compress' ? 'crack_ext_compress_prompt' : 'crack_ext_custom_prompt';
            localStorage.setItem(promptKey, txtResult.value.trim());
            showToast('✅ 프롬프트가 저장되었습니다!');
        };

        function updateSelectionCount() {
            var selectedText = txtResult.value.substring(txtResult.selectionStart, txtResult.selectionEnd);
            selCounter.textContent = selectedText.length > 0 ? '(드래그: ' + selectedText.length + '자)' : '';
        }
        txtResult.addEventListener('select', updateSelectionCount);
        txtResult.addEventListener('keyup', updateSelectionCount);
        txtResult.addEventListener('mouseup', updateSelectionCount);

        function updatePreviewCards() {
            if (isPromptMode) { previewCards.innerHTML = ''; cardNav.style.display = 'none'; return; }
            var content = txtResult.value.trim();
            if (!content) { previewCards.innerHTML = ''; cardNav.style.display = 'none'; parsedCards = []; return; }

            if (currentPromptMode === 'compress') {
                var blocks = content.split(/\n(?=\[)/);
                parsedCards = [];
                blocks.forEach(block => {
                    var titleMatch = block.match(/^\[(.*?)\]/);
                    if (titleMatch) {
                        var title = titleMatch[1].trim();
                        var summary = block.replace(/^\[.*?\]\n?/, '').trim();
                        parsedCards.push({ title, summary });
                    }
                });
                if (parsedCards.length === 0 && content) parsedCards.push({ title: '압축 요약', summary: content });
            } else {
                var blocks2 = content.split(/\[(.*?)\]/);
                parsedCards = [];
                for (var i = 1; i < blocks2.length; i += 2) {
                    var title = blocks2[i].trim();
                    var summary = blocks2[i + 1] ? blocks2[i + 1].replace(/^[\s\n]*[-*]?\s*/, '').trim() : '';
                    if (title || summary) parsedCards.push({ title, summary });
                }
                if (parsedCards.length === 0 && content) parsedCards.push({ title: '수동 요약', summary: content.replace(/^[\s\n]*[-*]?\s*/, '').trim() });
            }

            if (parsedCards.length === 0) { previewCards.innerHTML = ''; cardNav.style.display = 'none'; return; }
            if (currentCardIndex >= parsedCards.length) currentCardIndex = parsedCards.length - 1;
            if (currentCardIndex < 0) currentCardIndex = 0;
            cardNav.style.display = parsedCards.length > 1 ? 'flex' : 'none';
            if (parsedCards.length > 1) spanCardPage.textContent = (currentCardIndex + 1) + ' / ' + parsedCards.length;

            var mem = parsedCards[currentCardIndex];
            var tClass = mem.title.length > 20 ? 'crack-ext-count-error' : '';
            var sClass = mem.summary.length >= 300 ? 'crack-ext-count-error' : '';

            previewCards.innerHTML = '<div class="crack-ext-session-card">' +
                '<div class="crack-ext-session-title"><div><span style="color:#888;">[ </span>' + escapeHtml(mem.title) + '<span style="color:#888;"> ]</span></div>' +
                '<span class="crack-ext-char-count ' + tClass + '">(' + mem.title.length + '/20자)</span></div>' +
                '<div class="crack-ext-session-content">' + escapeHtml(mem.summary) +
                '<div style="text-align:right;margin-top:6px;"><span class="crack-ext-char-count ' + sClass + '">(' + mem.summary.length + '/300자)</span></div></div></div>';
        }

        txtResult.addEventListener('input', updatePreviewCards);
        btnCardPrev.onclick = e => { e.preventDefault(); if (currentCardIndex > 0) { currentCardIndex--; updatePreviewCards(); } };
        btnCardNext.onclick = e => { e.preventDefault(); if (currentCardIndex < parsedCards.length - 1) { currentCardIndex++; updatePreviewCards(); } };

        overlay.querySelectorAll('.crack-ext-export-btn').forEach(btn => {
            btn.onclick = function(e) {
                e.preventDefault();
                var format = btn.dataset.export;
                var cards = parsedCards.length > 0 ? parsedCards : [];
                if (cards.length === 0) { var c = txtResult.value.trim(); if (c) cards = [{ title: '요약', summary: c }]; }
                if (cards.length === 0) { alert('내보낼 내용이 없습니다.'); return; }
                var timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
                var filename, content, mimeType;
                switch(format) {
                    case 'json': filename = 'summary_' + timestamp + '.json'; content = exportAsJson(cards); mimeType = 'application/json'; break;
                    case 'md': filename = 'summary_' + timestamp + '.md'; content = exportAsMarkdown(cards); mimeType = 'text/markdown'; break;
                    default: filename = 'summary_' + timestamp + '.txt'; content = exportAsTxt(cards); mimeType = 'text/plain';
                }
                downloadFile(content, filename, mimeType);
                showToast(format.toUpperCase() + ' 파일로 내보냈습니다.');
            };
        });

        btnCancel.onclick = e => { e.stopPropagation(); overlay.remove(); };
        overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });

        btnCompress.onclick = function(e) { e.stopPropagation(); overlay.remove(); showCompressModal(); };

        btnGen.onclick = async function(e) {
            e.stopPropagation();
            var provider = selProvider.value;
            var apiKey = inputKey.value.trim();
            var firebaseScript = inputFirebase.value.trim();
            var model = selModel.value;
            var turnsVal = parseInt(inputTurns.value, 10);
            var turns = isNaN(turnsVal) ? 15 : turnsVal;
            var style = selStyle.value;

            if (provider !== 'firebase' && !apiKey) return alert("API Key를 입력해주세요.");
            if (provider === 'firebase' && !firebaseScript) return alert("Firebase 스크립트를 입력해주세요.");

            localStorage.setItem('crack_ext_api_provider', provider);
            localStorage.setItem('crack_ext_' + provider + '_model', model);
            localStorage.setItem('crack_ext_turn_count', turns.toString());
            localStorage.setItem('crack_ext_summary_style', style);
            if (provider === 'google') localStorage.setItem('crack_ext_gemini_key', apiKey);
            if (provider === 'deepseek') localStorage.setItem('crack_ext_deepseek_key', apiKey);
            if (provider === 'firebase') localStorage.setItem('crack_ext_firebase_script', firebaseScript);

            btnGen.disabled = true; btnSave.disabled = true;
            txtResult.value = "요약 중..."; currentCardIndex = 0; updatePreviewCards();

            try {
                var chatLog = await fetchRecentMessages(turns);
                if (!chatLog) throw new Error("내역을 불러올 수 없습니다.");
                var config = { apiKey, model, firebaseScript };
                var finalResult = await callAI(provider, config, chatLog, turns, style, false);
                txtResult.value = finalResult.trim();
            } catch (err) {
                txtResult.value = "오류: " + err.message;
            } finally {
                btnGen.disabled = false; btnSave.disabled = false;
                btnGen.textContent = "재생성 (리롤)";
                updatePreviewCards();
            }
        };

        btnSave.onclick = async function(e) {
            e.stopPropagation();
            var isExceeded = false, errorIndex = -1;
            for (var i = 0; i < parsedCards.length; i++) {
                if (parsedCards[i].title.length > 20 || parsedCards[i].summary.length >= 300) {
                    isExceeded = true; errorIndex = i; break;
                }
            }
            if (isExceeded) {
                currentCardIndex = errorIndex;
                updatePreviewCards();
                alert("글자 수 제한(제목 20자, 내용 300자 미만)을 초과한 항목이 있습니다.");
                return;
            }
            btnSave.disabled = true; btnCancel.disabled = true;
            var successCount = 0;
            for (var i = 0; i < parsedCards.length; i++) {
                btnSave.textContent = "추가 중... (" + (i + 1) + "/" + parsedCards.length + ")";
                await new Promise(resolve => setTimeout(resolve, 50));
                var res = await apiCall('POST', '/summaries', { type: 'shortTerm', title: parsedCards[i].title, summary: parsedCards[i].summary });
                if (res) successCount++;
                else alert('[' + parsedCards[i].title + '] 추가 중 오류 발생');
            }
            if (successCount > 0) {
                showToast(successCount + '개의 요약이 장기 기억에 추가되었습니다.');
                overlay.remove();
                var dialogEl = document.querySelector('[role="dialog"]');
                if (dialogEl) refreshCurrentTab(dialogEl);
            } else {
                btnSave.textContent = "추가하기"; btnSave.disabled = false; btnCancel.disabled = false;
            }
        };

        if (prefillText) { txtResult.value = prefillText; updatePreviewCards(); }
    }

    function injectTopHeaderBtn() {
        var headerContainer = document.querySelector('.absolute.z-\\[5\\] .flex.gap-3.items-center');
        if (!headerContainer || headerContainer.querySelector('.crack-ext-header-ai-btn')) return;
        var aiBtn = document.createElement('button');
        aiBtn.className = 'crack-ext-header-ai-btn';
        aiBtn.innerHTML = 'AI 요약';
        aiBtn.addEventListener('click', e => { e.stopPropagation(); e.preventDefault(); showMainModal(); });
        headerContainer.prepend(aiBtn);
    }

    function inject() { injectAiStyles(); injectTopHeaderBtn(); }

    function start() {
        var obs = new MutationObserver(() => { requestAnimationFrame(inject); });
        obs.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
        setInterval(inject, 800);
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
    else start();
})();
