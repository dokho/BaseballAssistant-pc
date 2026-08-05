let state;
const app = document.querySelector('#app');
const modalRoot = document.querySelector('#modal-root');

const esc = (value) => String(value ?? '').replace(/[&<>'"]/g, (char) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' })[char]);
const activeGame = () => state?.games.find((game) => game.id === state.activeGameId);
const halfLabel = (game) => game.half === 'top' ? '上半局' : '下半局';
const timeLabel = (iso) => new Date(iso).toLocaleTimeString('zh-CN', { hour:'2-digit', minute:'2-digit' });
const dateLabel = (iso) => new Date(iso).toLocaleDateString('zh-CN', { month:'2-digit', day:'2-digit' });
const logo = (team) => team.logo ? `<img src="${team.logo}" alt="" />` : esc((team.shortName || '?').slice(0, 2).toUpperCase());
const lamps = (value, max, type) => Array.from({ length:max }, (_, i) => `<i class="lamp ${type} ${i < value ? 'on' : ''}"></i>`).join('');
const overlayColor = (value, fallback) => /^#[0-9a-f]{6}$/i.test(value || '') ? value : fallback;

function toast(message) {
  const node = document.createElement('div'); node.className = 'toast'; node.textContent = message;
  document.querySelector('#toast-root').append(node); setTimeout(() => node.remove(), 2600);
}

function previewLamps(value, max, type) {
  return Array.from({ length: max }, (_, index) => `<i class="reference-lamp ${type} ${index < value ? 'on' : ''}"></i>`).join('');
}

function preview(game, settings) {
  const title = String(settings.overlayTitle || '').trim() || game.title || '棒球比赛';
  const background = overlayColor(settings.overlayBackgroundColor, '#2857a6');
  const away = overlayColor(game.away.color, '#3d43c6');
  const home = overlayColor(game.home.color, '#19b5e5');
  return `<div class="reference-preview" style="--overlay-background:${background};--away-team-background:${away};--home-team-background:${home}">
    <div class="reference-title">${esc(title)}</div>
    <div class="reference-main">
      <div class="reference-teams">
        <div class="reference-team away ${game.away.logo ? 'has-logo' : ''}"><span class="reference-team-logo">${game.away.logo ? `<img src="${game.away.logo}" alt="" />` : ''}</span><strong>${esc(game.away.shortName || game.away.fullName)}</strong><b>${game.score.away}</b></div>
        <div class="reference-team home ${game.home.logo ? 'has-logo' : ''}"><span class="reference-team-logo">${game.home.logo ? `<img src="${game.home.logo}" alt="" />` : ''}</span><strong>${esc(game.home.shortName || game.home.fullName)}</strong><b>${game.score.home}</b></div>
      </div>
      <div class="reference-inning"><span class="${game.half==='top'?'active':''}">▲</span><b>${game.currentInning}</b><span class="${game.half==='bottom'?'active':''}">▼</span></div>
      <div class="reference-bases">
        <div class="reference-diamond">
          <button class="reference-base first ${game.bases[0]?'on':''}" data-action="toggle-base" data-index="0" aria-label="一垒"></button>
          <button class="reference-base second ${game.bases[1]?'on':''}" data-action="toggle-base" data-index="1" aria-label="二垒"></button>
          <button class="reference-base third ${game.bases[2]?'on':''}" data-action="toggle-base" data-index="2" aria-label="三垒"></button>
        </div>
      </div>
    </div>
    <div class="reference-counts">
      <div><b>B</b><span>${previewLamps(game.balls,3,'ball')}</span></div>
      <div><b>S</b><span>${previewLamps(game.strikes,2,'strike')}</span></div>
      <div><b>O</b><span>${previewLamps(game.outs,2,'out')}</span></div>
    </div>
  </div>`;
}

function render() {
  const game = activeGame();
  if (!game) { app.innerHTML = '<div class="boot">暂无比赛</div>'; return; }
  const innings = [...game.innings].sort((a,b)=>a.number-b.number);
  app.innerHTML = `<div class="shell">
    <header class="topbar"><div class="brand"><span class="brand-mark"></span><div class="brand-copy"><strong>棒球比赛助手电脑版</strong><span>LOCAL BROADCAST CONSOLE</span></div></div>
      <div class="top-actions"><button class="btn ghost" data-action="undo" ${!game.undoStack.length?'disabled':''}>↶ 撤销 <small>Ctrl+Z</small></button><button class="btn ghost" data-action="redo" ${!game.redoStack.length?'disabled':''}>↷ 重做</button><button class="btn primary" data-action="show-overlay">打开比分牌窗口</button></div></header>
    <div class="layout"><aside class="sidebar"><div class="sidebar-title"><strong>比赛历史</strong><span>${state.games.length} 场</span></div><div class="game-list">
      ${state.games.map((item)=>`<button class="game-item ${item.id===game.id?'active':''}" data-action="activate-game" data-id="${item.id}"><span class="game-name">${esc(item.title)}</span><span class="game-meta"><span><i class="status-dot ${item.status}"></i>${item.status==='finished'?'已结束':'进行中'}</span><span>${dateLabel(item.updatedAt)}</span></span></button>`).join('')}
      </div><div class="side-tools"><button class="btn primary wide" data-action="new-game">＋ 新建比赛</button><div class="row"><button class="btn wide" data-action="import">导入</button><button class="btn wide" data-action="export">备份</button></div><button class="btn ghost wide" data-action="data-folder">打开数据目录</button><button class="btn ghost wide" data-action="log-folder">打开诊断日志</button></div></aside>
      <main class="content"><div class="page-head"><div><h1>${esc(game.title)}</h1><p>${esc(game.away.fullName)} vs ${esc(game.home.fullName)} · 计划 ${game.scheduledInnings} 局 · 实际赛程不受限制</p></div><span class="live-state ${game.syncPaused?'paused':''}">${game.syncPaused?'● 直播画面已锁定':'● 正在实时同步'}</span></div>
        <div class="grid">${game.syncPaused?`<div class="sync-banner"><span>当前修改尚未显示在直播比分牌上。</span><span class="row"><button class="btn ghost" data-action="discard">放弃修改</button><button class="btn warn" data-action="publish">发布到直播</button></span></div>`:''}
          <section class="stack"><article class="card"><div class="card-head"><strong>直播画面预览</strong><small>推荐输出尺寸 680 × 280</small></div><div class="preview-wrap">${preview(game, state.settings)}</div></article>
            <article class="card"><div class="card-head"><strong>比分控制</strong><button class="btn ghost" data-action="edit-title">编辑比赛</button></div><div class="card-body team-controls">
              ${['away','home'].map((side)=>{const team=game[side];return `<div class="team-control"><div class="team-control-head"><span class="mini-logo">${logo(team)}</span><div><strong>${esc(team.shortName)}</strong><small>${side==='away'?'客队 · 上半局进攻':'主队 · 下半局进攻'}</small></div><button class="btn ghost" style="margin-left:auto" data-action="edit-team" data-side="${side}">编辑</button></div><div class="score-control"><button class="btn icon danger" data-action="run" data-side="${side}" data-delta="-1">−</button><strong>${game.score[side]}</strong><button class="btn icon green" data-action="run" data-side="${side}" data-delta="1">＋</button></div></div>`}).join('')}
            </div></article>
            <article class="card"><div class="card-head"><strong>投球与出局</strong><small>快捷键 B / S / F / O</small></div><div class="card-body"><div class="operation-grid"><button class="op-btn ball" data-action="ball"><span>坏球</span><small>BALL · B</small></button><button class="op-btn strike" data-action="strike"><span>好球</span><small>STRIKE · S</small></button><button class="op-btn strike" data-action="foul"><span>界外</span><small>FOUL · F</small></button><button class="op-btn out" data-action="out"><span>出局</span><small>OUT · O</small></button></div>
              <div class="direct-grid">${[['balls','坏球',game.balls,3],['strikes','好球',game.strikes,2],['outs','出局',game.outs,2]].map(([field,label,value,max])=>`<div class="stepper"><label>${label}直接修正</label><div class="stepper-row"><button data-action="set-count" data-field="${field}" data-value="${Math.max(0,value-1)}">−</button><b>${value}</b><button data-action="set-count" data-field="${field}" data-value="${Math.min(max,value+1)}">＋</button></div></div>`).join('')}</div>
              <div class="row" style="margin-top:12px;flex-wrap:wrap"><button class="btn" data-action="hit" data-bases="1">一垒安打</button><button class="btn" data-action="hit" data-bases="2">二垒打</button><button class="btn" data-action="hit" data-bases="3">三垒打</button><button class="btn warn" data-action="hit" data-bases="4">本垒打</button><button class="btn ghost" data-action="log-event" data-label="失误">记录失误</button><button class="btn ghost" data-action="log-event" data-label="双杀">记录双杀</button></div>
            </div></article>
            <article class="card"><div class="card-head"><strong>逐局比分</strong><small>总分由各局自动汇总</small></div><div class="innings-scroll"><table class="innings-table"><thead><tr><th>球队</th>${innings.map(i=>`<th class="${i.number===game.currentInning?'current-col':''}">${i.number}</th>`).join('')}<th>R</th></tr></thead><tbody><tr><td>${esc(game.away.shortName)}</td>${innings.map(i=>`<td class="${i.number===game.currentInning?'current-col':''}">${i.away}</td>`).join('')}<td class="total-col">${game.score.away}</td></tr><tr><td>${esc(game.home.shortName)}</td>${innings.map(i=>`<td class="${i.number===game.currentInning?'current-col':''}">${i.home}</td>`).join('')}<td class="total-col">${game.score.home}</td></tr></tbody></table></div></article>
          </section>
          <aside class="stack"><article class="card"><div class="card-head"><strong>局面控制</strong><small>${game.half==='top'?esc(game.away.shortName):esc(game.home.shortName)} 进攻</small></div><div class="card-body"><div class="row" style="justify-content:space-between"><button class="btn icon" data-action="inning-step" data-delta="-1">−</button><b style="font-size:20px">第 ${game.currentInning} 局 · ${halfLabel(game)}</b><button class="btn icon" data-action="inning-step" data-delta="1">＋</button></div><div class="row" style="margin-top:11px"><button class="btn wide ${game.half==='top'?'primary':''}" data-action="set-half" data-half="top">上半局</button><button class="btn wide ${game.half==='bottom'?'primary':''}" data-action="set-half" data-half="bottom">下半局</button></div><button class="btn warn wide" style="margin-top:9px" data-action="end-half">确认结束当前半局</button></div></article>
            <article class="card"><div class="card-head"><strong>垒上情况</strong><button class="btn ghost" data-action="clear-bases">清空</button></div><div class="card-body base-panel"><div class="diamond big-diamond"><i class="base b1 ${game.bases[0]?'on':''}" data-action="toggle-base" data-index="0"></i><i class="base b2 ${game.bases[1]?'on':''}" data-action="toggle-base" data-index="1"></i><i class="base b3 ${game.bases[2]?'on':''}" data-action="toggle-base" data-index="2"></i></div><div class="base-actions">${['一垒','二垒','三垒'].map((label,index)=>`<button class="btn ${game.bases[index]?'warn':''}" data-action="toggle-base" data-index="${index}">${label}<br><small>${game.bases[index]?'有人':'空垒'}</small></button>`).join('')}<button class="btn ghost" data-action="walk">四坏保送</button></div></div></article>
            <article class="card"><div class="card-head"><strong>直播输出</strong><small>OBS / 抖音 / 视频号</small></div><div class="card-body overlay-settings"><div><small style="color:var(--muted)">背景模式</small><div class="segmented" style="margin-top:7px">${[['green','绿幕'],['transparent','透明'],['solid','纯色']].map(([value,label])=>`<button class="${state.settings.overlayMode===value?'active':''}" data-action="overlay-mode" data-value="${value}">${label}</button>`).join('')}</div></div><div class="overlay-customization"><div class="field"><label>顶部比赛标题（留空时显示比赛名称）</label><input data-overlay-setting="overlayTitle" value="${esc(state.settings.overlayTitle || '')}" placeholder="例如：北京市青少年棒球锦标赛" maxlength="60" /></div><div class="color-settings"><div class="field"><label>比分牌背景</label><input class="color-input" data-overlay-setting="overlayBackgroundColor" type="color" value="${overlayColor(state.settings.overlayBackgroundColor, '#2857a6')}" /></div></div><p class="help">球队名称背景色请在“编辑客队/主队资料”中设置。</p></div><div class="switch-row"><span>窗口始终置顶</span><button class="switch ${state.settings.overlayAlwaysOnTop?'on':''}" data-action="always-on-top"></button></div><div class="switch-row"><span>鼠标穿透（开启时无法拖动）</span><button class="switch ${state.settings.clickThrough?'on':''}" data-action="click-through"></button></div><div class="row"><button class="btn wide" data-action="focus-overlay">定位窗口</button><button class="btn wide" data-action="reset-overlay">恢复 680×280</button></div><button class="btn ${game.syncPaused?'green':'warn'} wide" data-action="toggle-sync">${game.syncPaused?'发布并恢复同步':'暂停直播同步'}</button></div></article>
            <article class="card"><div class="card-head"><strong>操作记录</strong><small>最近 ${Math.min(500,game.events.length)} 条</small></div><div class="card-body event-list">${game.events.length?game.events.slice(0,30).map(e=>`<div class="event"><span class="event-time">${timeLabel(e.at)}</span><span>${esc(e.label)}</span><span class="event-inning">${e.inning}局${e.half==='top'?'上':'下'}</span></div>`).join(''):'<div class="empty-state">比赛操作将显示在这里</div>'}</div></article>
            <article class="card"><div class="card-body"><div class="row"><button class="btn wide" data-action="duplicate">复制比赛</button><button class="btn wide ${game.status==='finished'?'green':'danger'}" data-action="toggle-finished">${game.status==='finished'?'恢复比赛':'结束比赛'}</button><button class="btn ghost" data-action="delete-game">删除</button></div></div></article>
          </aside>
        </div></main></div></div>`;
}

function modal({ title, body, confirmText='确认', danger=false, onConfirm }) {
  modalRoot.innerHTML = `<div class="modal-backdrop"><section class="modal"><header class="modal-head"><h2>${esc(title)}</h2></header><div class="modal-body">${body}</div><footer class="modal-actions"><button class="btn ghost" data-modal="cancel">取消</button><button class="btn ${danger?'danger':'primary'}" data-modal="confirm">${esc(confirmText)}</button></footer></section></div>`;
  modalRoot.querySelector('[data-modal="cancel"]').onclick = closeModal;
  modalRoot.querySelector('.modal-backdrop').onclick = (event) => { if (event.target.classList.contains('modal-backdrop')) closeModal(); };
  modalRoot.querySelector('[data-modal="confirm"]').onclick = async () => { const result = await onConfirm?.(modalRoot); if (result !== false) closeModal(); };
}
function closeModal(){ modalRoot.innerHTML=''; }

async function dispatch(action) { state = await window.baseballAPI.dispatch(action); render(); }
function confirmAction(title, message, action, confirmText='确认执行') { modal({ title, body:`<p>${message}</p>`, confirmText, onConfirm:()=>dispatch(action) }); }

function newGameModal() {
  modal({ title:'新建比赛', confirmText:'创建比赛', body:`<div class="form-grid"><div class="field"><label>比赛名称</label><input id="new-title" value="新比赛 ${new Date().toLocaleDateString('zh-CN')}" /></div><div class="form-two"><div class="field"><label>客队简称</label><input id="new-away" value="AWAY" maxlength="12" /></div><div class="field"><label>主队简称</label><input id="new-home" value="HOME" maxlength="12" /></div></div><div class="field"><label>计划局数（仅作提示）</label><input id="new-innings" type="number" min="1" max="99" value="9" /></div><p class="help">实际比赛可以提前结束或继续进入延长局。</p></div>`, onConfirm:async(root)=>{ const title=root.querySelector('#new-title').value.trim(); const away=root.querySelector('#new-away').value.trim(); const home=root.querySelector('#new-home').value.trim(); state=await window.baseballAPI.newGame({title,scheduledInnings:Number(root.querySelector('#new-innings').value),away:{fullName:away,shortName:away},home:{fullName:home,shortName:home}}); render(); } });
}

function editTeamModal(side) {
  const team=activeGame()[side];
  modal({ title:`编辑${side==='away'?'客队':'主队'}资料`, confirmText:'保存资料', body:`<div class="form-grid"><div class="form-two"><div class="field"><label>球队全称</label><input id="team-full" value="${esc(team.fullName)}" /></div><div class="field"><label>直播简称</label><input id="team-short" maxlength="12" value="${esc(team.shortName)}" /></div></div><div class="form-two"><div class="field"><label>球队名称背景色</label><input class="color-input" id="team-color" type="color" value="${esc(team.color)}" /></div><div class="field"><label>队徽（可选）</label><input id="team-logo" type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" /></div></div><div class="row"><div class="logo-preview" id="logo-preview">${logo(team)}</div><button class="btn ghost" type="button" id="remove-logo">移除队徽</button></div><p class="help">队徽会显示在直播比分牌的球队名称左侧。推荐使用正方形透明 PNG。</p></div>`, onConfirm:async(root)=>{ const shortName=root.querySelector('#team-short').value.trim(); if(!shortName){toast('请输入直播简称');return false;} const newLogo=root.querySelector('#logo-preview').dataset.logo ?? team.logo; await dispatch({type:'SET_TEAM',side,team:{fullName:root.querySelector('#team-full').value.trim()||shortName,shortName,color:root.querySelector('#team-color').value,logo:newLogo||null}}); } });
  const fileInput=modalRoot.querySelector('#team-logo'); const previewNode=modalRoot.querySelector('#logo-preview');
  fileInput.onchange=()=>{const file=fileInput.files[0];if(!file)return;if(file.size>2*1024*1024){toast('队徽图片请小于 2MB');fileInput.value='';return;}const reader=new FileReader();reader.onload=()=>{previewNode.innerHTML=`<img src="${reader.result}" alt="" />`;previewNode.dataset.logo=reader.result;};reader.readAsDataURL(file);};
  modalRoot.querySelector('#remove-logo').onclick=()=>{previewNode.textContent=team.shortName.slice(0,2);previewNode.dataset.logo='';};
}

function editTitleModal(){const game=activeGame();modal({title:'编辑比赛信息',confirmText:'保存',body:`<div class="form-grid"><div class="field"><label>比赛名称</label><input id="edit-title" value="${esc(game.title)}" /></div><div class="field"><label>计划局数</label><input id="edit-innings" type="number" min="1" max="99" value="${game.scheduledInnings}" /></div></div>`,onConfirm:async(root)=>{await dispatch({type:'SET_TITLE',title:root.querySelector('#edit-title').value});await dispatch({type:'SET_SCHEDULED_INNINGS',value:Number(root.querySelector('#edit-innings').value)});}})}

app.addEventListener('click', async (event) => {
  const el=event.target.closest('[data-action]'); if(!el)return; const game=activeGame(); const action=el.dataset.action;
  if(action==='undo')return dispatch({type:'UNDO'}); if(action==='redo')return dispatch({type:'REDO'});
  if(action==='new-game')return newGameModal(); if(action==='activate-game'){state=await window.baseballAPI.activateGame(el.dataset.id);return render();}
  if(action==='edit-team')return editTeamModal(el.dataset.side); if(action==='edit-title')return editTitleModal();
  if(action==='run')return dispatch({type:'ADJUST_RUN',side:el.dataset.side,delta:Number(el.dataset.delta)});
  if(action==='toggle-base')return dispatch({type:'SET_BASE',index:Number(el.dataset.index),value:!game.bases[Number(el.dataset.index)]});
  if(action==='clear-bases')return dispatch({type:'CLEAR_BASES'});
  if(action==='ball'){if(game.balls>=3)return confirmAction('确认四坏保送','这是第四个坏球。确认后打者上一垒，并自动处理被迫进垒；满垒时将增加一分。',{type:'WALK'},'执行保送');return dispatch({type:'BALL'});}
  if(action==='walk')return confirmAction('确认四坏保送','系统将自动处理被迫进垒，并清空球数。',{type:'WALK'},'执行保送');
  if(action==='strike'){if(game.strikes>=2)return confirmAction('确认三振出局',game.outs>=2?'这是第三个好球且已有两出局，确认后将自动结束当前半局。':'这是第三个好球，确认后出局数加一并清空球数。',{type:'STRIKEOUT'},'确认三振');return dispatch({type:'STRIKE'});}
  if(action==='foul')return dispatch({type:'FOUL'});
  if(action==='out'){if(game.outs>=2)return confirmAction('确认第三个出局','确认后将清空 BSO 与垒包，并自动切换到下一半局。',{type:'OUT'},'结束半局');return dispatch({type:'OUT'});}
  if(action==='set-count')return dispatch({type:'SET_COUNT',field:el.dataset.field,value:Number(el.dataset.value)});
  if(action==='hit'){const bases=Number(el.dataset.bases);const names=['','一垒安打','二垒打','三垒打','本垒打'];return confirmAction(`确认${names[bases]}`,bases===4?'所有垒上跑者与打者都将得分。':'系统将按固定垒数给出进垒结果。实际跑垒不同可在确认后直接修正垒包和比分。',{type:'APPLY_HIT',bases,label:names[bases]},'应用建议');}
  if(action==='log-event')return dispatch({type:'LOG_EVENT',label:el.dataset.label});
  if(action==='inning-step')return dispatch({type:'SET_INNING',inning:Math.max(1,game.currentInning+Number(el.dataset.delta)),half:game.half});
  if(action==='set-half')return confirmAction('修正上下半局',`将当前局面改为第 ${game.currentInning} 局${el.dataset.half==='top'?'上半局':'下半局'}。垒包和 BSO 不会自动清空。`,{type:'SET_INNING',inning:game.currentInning,half:el.dataset.half});
  if(action==='end-half')return confirmAction('结束当前半局',`确认结束第 ${game.currentInning} 局${halfLabel(game)}？系统将清空 BSO 和全部垒包。`,{type:'END_HALF'},'确认换局');
  if(action==='show-overlay'){await window.baseballAPI.overlayCommand({type:'show'});return toast('比分牌窗口已打开');}
  if(action==='focus-overlay')return window.baseballAPI.overlayCommand({type:'focus'});
  if(action==='reset-overlay')return window.baseballAPI.overlayCommand({type:'reset-size'});
  if(action==='overlay-mode'){state=await window.baseballAPI.overlayCommand({type:'mode',value:el.dataset.value});return render();}
  if(action==='always-on-top'){state=await window.baseballAPI.overlayCommand({type:'always-on-top',value:!state.settings.overlayAlwaysOnTop});return render();}
  if(action==='click-through'){state=await window.baseballAPI.overlayCommand({type:'click-through',value:!state.settings.clickThrough});return render();}
  if(action==='toggle-sync')return game.syncPaused?dispatch({type:'PUBLISH'}):dispatch({type:'PAUSE_SYNC'});
  if(action==='publish')return dispatch({type:'PUBLISH'}); if(action==='discard')return confirmAction('放弃未发布修改','操作台将恢复到直播比分牌当前显示的状态。',{type:'DISCARD_DRAFT'},'放弃修改');
  if(action==='duplicate'){state=await window.baseballAPI.duplicateGame(game.id);render();return toast('已创建比赛副本');}
  if(action==='toggle-finished')return confirmAction(game.status==='finished'?'恢复比赛':'结束比赛',game.status==='finished'?'恢复后可以继续记录比赛。':'历史数据会保留，之后仍可重新打开或恢复。',{type:'SET_STATUS',status:game.status==='finished'?'live':'finished'},game.status==='finished'?'恢复':'结束比赛');
  if(action==='delete-game')return modal({title:'删除比赛',danger:true,confirmText:'确认删除',body:`<p class="danger-text">将永久删除“${esc(game.title)}”及其操作记录。建议先导出备份。</p>`,onConfirm:async()=>{const result=await window.baseballAPI.deleteGame(game.id);if(!result.ok){toast(result.message);return false;}state=result.state;render();}});
  if(action==='export'){const result=await window.baseballAPI.exportData();if(result.ok)toast('备份已导出');return;}
  if(action==='import'){const result=await window.baseballAPI.importData();toast(result.ok?'备份已导入':result.message||'已取消导入');return;}
  if(action==='data-folder')return window.baseballAPI.openDataFolder();
  if(action==='log-folder')return window.baseballAPI.openLogFolder();
});

app.addEventListener('change', async (event) => {
  const input = event.target.closest('[data-overlay-setting]');
  if (!input) return;
  const key = input.dataset.overlaySetting;
  state = await window.baseballAPI.overlayCommand({ type: 'settings', value: { [key]: input.value } });
  render();
});

document.addEventListener('keydown',(event)=>{
  if(modalRoot.innerHTML||['INPUT','TEXTAREA','SELECT'].includes(event.target.tagName))return;
  if(event.ctrlKey&&event.key.toLowerCase()==='z'){event.preventDefault();return dispatch({type:event.shiftKey?'REDO':'UNDO'});}
  const key=event.key.toLowerCase();const map={b:'ball',s:'strike',f:'foul',o:'out'};if(map[key]){event.preventDefault();app.querySelector(`[data-action="${map[key]}"]`)?.click();}
});

window.baseballAPI.onState((next)=>{state=next;render();});
window.baseballAPI.getState().then((initial)=>{state=initial;render();});
