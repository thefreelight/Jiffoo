/**
 * i18n Admin Routes
 *
 * Serves the translation management admin panel.
 * Self-contained HTML SPA with side-by-side translation editor.
 */

import { Router } from 'express';

export const adminRoutes = Router();

adminRoutes.get('/', (_req, res) => {
  res.type('text/html; charset=utf-8');
  res.send(renderAdminHtml());
});

// ============================================================================
// Admin HTML (self-contained SPA)
// ============================================================================

function renderAdminHtml(): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Localization</title>
<style>
:root{
  --bg:#f5f8fc;--panel:#fff;--line:#d8e2ef;--text:#111827;--muted:#5b667a;
  --accent:#0f766e;--accent-soft:#ecfdf5;--danger:#dc2626;--danger-soft:#fef2f2;
  --warn:#d97706;--success:#059669;
  --radius:16px;--shadow:0 12px 36px rgba(15,23,42,.06);
}
*{box-sizing:border-box;margin:0}
body{background:var(--bg);color:var(--text);font-family:"SF Pro Text","Segoe UI",system-ui,sans-serif;font-size:14px}
main{max-width:1100px;margin:0 auto;padding:24px 20px 60px}

/* Tabs */
.tabs{display:flex;gap:2px;background:var(--line);border-radius:12px;padding:3px;margin-bottom:20px}
.tab{flex:1;padding:10px 16px;border:0;border-radius:10px;background:transparent;font:inherit;font-weight:600;color:var(--muted);cursor:pointer;transition:.15s}
.tab.active{background:var(--panel);color:var(--text);box-shadow:0 2px 8px rgba(0,0,0,.06)}
.tab-content{display:none}.tab-content.active{display:block}

/* Panel */
.panel{background:var(--panel);border:1px solid var(--line);border-radius:var(--radius);box-shadow:var(--shadow);padding:20px;margin-bottom:16px}
.panel h2{font-size:16px;margin-bottom:12px}
.panel p{color:var(--muted);line-height:1.5;margin-bottom:12px}

/* Form */
.row{display:flex;gap:10px;align-items:end;flex-wrap:wrap;margin-bottom:12px}
.field{display:flex;flex-direction:column;gap:4px;flex:1;min-width:120px}
.field label{font-size:12px;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:.05em}
.field input,.field select{padding:8px 12px;border:1px solid var(--line);border-radius:10px;font:inherit;background:#fff}
.field input:focus,.field select:focus{outline:none;border-color:var(--accent)}
textarea{width:100%;padding:8px 12px;border:1px solid var(--line);border-radius:10px;font:inherit;resize:vertical;min-height:60px}
textarea:focus{outline:none;border-color:var(--accent)}

/* Buttons */
.btn{padding:8px 16px;border:0;border-radius:10px;font:inherit;font-weight:600;cursor:pointer;transition:.15s}
.btn-primary{background:var(--accent);color:#fff}.btn-primary:hover{opacity:.9}
.btn-danger{background:var(--danger-soft);color:var(--danger)}.btn-danger:hover{background:#fee}
.btn-ghost{background:transparent;color:var(--muted);border:1px solid var(--line)}.btn-ghost:hover{background:#f9fafb}
.btn-sm{padding:5px 10px;font-size:12px}
.btn:disabled{opacity:.5;cursor:default}

/* Table */
.table{width:100%;border-collapse:collapse}
.table th,.table td{text-align:left;padding:10px 12px;border-bottom:1px solid #f3f4f6}
.table th{font-size:12px;color:var(--muted);font-weight:600;text-transform:uppercase;letter-spacing:.04em}
.table tr:hover td{background:#fafbfc}

/* Side-by-side editor */
.editor-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}
.editor-col h3{font-size:13px;color:var(--muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:10px}
.editor-field{margin-bottom:14px}
.editor-field label{display:block;font-size:12px;font-weight:600;color:var(--muted);margin-bottom:4px;text-transform:uppercase;letter-spacing:.04em}
.editor-field .source-text{padding:8px 12px;background:#f9fafb;border:1px solid #eee;border-radius:10px;color:var(--text);min-height:36px;white-space:pre-wrap;word-break:break-word;font-size:14px;line-height:1.5}

/* Entity list */
.entity-list{max-height:400px;overflow-y:auto;border:1px solid var(--line);border-radius:12px}
.entity-item{padding:10px 14px;border-bottom:1px solid #f3f4f6;cursor:pointer;display:flex;justify-content:space-between;align-items:center;transition:.1s}
.entity-item:hover{background:#f0fdf4}
.entity-item.active{background:var(--accent-soft);font-weight:600}
.entity-item:last-child{border-bottom:0}

/* Badge */
.badge{font-size:11px;padding:2px 8px;border-radius:99px;font-weight:600}
.badge-ok{background:var(--accent-soft);color:var(--accent)}
.badge-warn{background:#fef3c7;color:var(--warn)}
.badge-default{background:#f3f4f6;color:var(--muted)}

/* Messages */
.msg{padding:10px 14px;border-radius:10px;font-size:13px;margin-bottom:10px}
.msg-ok{background:var(--accent-soft);color:var(--success)}
.msg-err{background:var(--danger-soft);color:var(--danger)}

/* Filter */
.filter-bar{display:flex;gap:8px;margin-bottom:12px}
.filter-bar input{flex:1}

/* Responsive */
@media(max-width:700px){.editor-grid{grid-template-columns:1fr}.row{flex-direction:column}}
</style>
</head>
<body>
<main>
  <div class="panel" style="padding:16px 20px">
    <div style="display:flex;align-items:center;gap:10px">
      <span style="display:inline-flex;padding:5px 9px;border-radius:99px;background:var(--accent-soft);color:var(--accent);font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.08em">i18n</span>
      <h1 style="font-size:20px">Translation Manager</h1>
    </div>
  </div>

  <div class="tabs">
    <button class="tab active" data-tab="languages">Languages</button>
    <button class="tab" data-tab="content">Content</button>
    <button class="tab" data-tab="ui">UI Strings</button>
  </div>

  <!-- ===== Languages Tab ===== -->
  <div id="tab-languages" class="tab-content active">
    <div class="panel">
      <h2>Managed Languages</h2>
      <p>Configure which languages are available for your storefront.</p>
      <div id="lang-msg"></div>
      <table class="table">
        <thead><tr><th>Locale</th><th>Name</th><th>Native</th><th>Fallback</th><th>Status</th><th></th></tr></thead>
        <tbody id="lang-body"><tr><td colspan="6" style="color:var(--muted)">Loading...</td></tr></tbody>
      </table>
    </div>
    <div class="panel">
      <h2>Add Language</h2>
      <form id="lang-form">
        <div class="row">
          <div class="field"><label>Locale Code</label><input id="lf-locale" placeholder="fr" required/></div>
          <div class="field"><label>English Name</label><input id="lf-name" placeholder="French" required/></div>
          <div class="field"><label>Native Name</label><input id="lf-native" placeholder="Fran&#231;ais" required/></div>
          <div class="field"><label>Fallback To</label><input id="lf-fallback" placeholder="en"/></div>
        </div>
        <button type="submit" class="btn btn-primary">Add Language</button>
      </form>
    </div>
  </div>

  <!-- ===== Content Translation Tab ===== -->
  <div id="tab-content" class="tab-content">
    <div class="panel">
      <h2>Content Translations</h2>
      <p>Translate product names, category names, and other dynamic content.</p>
      <div class="row">
        <div class="field">
          <label>Entity Type</label>
          <select id="ct-type"><option value="product">Products</option><option value="category">Categories</option></select>
        </div>
        <div class="field">
          <label>Target Language</label>
          <select id="ct-locale"></select>
        </div>
        <div style="padding-bottom:1px"><button class="btn btn-ghost" onclick="loadEntities()">Load</button></div>
      </div>
    </div>

    <div style="display:grid;grid-template-columns:280px 1fr;gap:16px">
      <!-- Entity list -->
      <div class="panel" style="padding:12px">
        <div class="filter-bar"><input id="ct-search" placeholder="Search..." oninput="filterEntities()"/></div>
        <div id="ct-entities" class="entity-list" style="max-height:520px">
          <div style="padding:20px;color:var(--muted);text-align:center">Select type and language, then click Load</div>
        </div>
      </div>

      <!-- Side-by-side editor -->
      <div class="panel" id="ct-editor">
        <div id="ct-editor-content" style="color:var(--muted);text-align:center;padding:40px 0">
          Select an item from the list to start translating
        </div>
      </div>
    </div>
  </div>

  <!-- ===== UI Strings Tab ===== -->
  <div id="tab-ui" class="tab-content">
    <div class="panel">
      <h2>UI String Translations</h2>
      <p>Override theme UI text (buttons, labels, navigation) for each language.</p>
      <div class="row">
        <div class="field">
          <label>Namespace</label>
          <select id="ui-ns"><option value="common">Common</option><option value="shop">Shop</option><option value="merchant">Merchant</option></select>
        </div>
        <div class="field">
          <label>Target Language</label>
          <select id="ui-locale"></select>
        </div>
        <div style="padding-bottom:1px"><button class="btn btn-ghost" onclick="loadUIStrings()">Load</button></div>
      </div>
    </div>
    <div class="panel">
      <div class="filter-bar"><input id="ui-search" placeholder="Filter keys..." oninput="filterUIKeys()"/></div>
      <div id="ui-msg"></div>
      <table class="table">
        <thead><tr><th style="width:30%">Key</th><th style="width:35%">Default Text</th><th style="width:35%">Translation</th></tr></thead>
        <tbody id="ui-body"><tr><td colspan="3" style="color:var(--muted)">Select namespace and language, then click Load</td></tr></tbody>
      </table>
      <div style="margin-top:12px"><button class="btn btn-primary" onclick="saveUIStrings()" id="ui-save-btn" disabled>Save All Changes</button></div>
    </div>
  </div>
</main>

<script>
// ============================================================================
// Helpers
// ============================================================================
function getToken(){return new URLSearchParams(window.location.search).get("token")||""}
function getSearchParams(){var p=new URLSearchParams(window.location.search);p.delete("token");return p.toString()}
function getPluginSlug(){var m=window.location.pathname.match(/\\/plugin-admin-ui\\/([^/]+)/);return m?m[1]:"i18n"}
function getPluginApiBase(){return"/api/extensions/plugin/"+getPluginSlug()+"/api"}

function buildApiUrl(path){
  var s=getSearchParams(),sep=path.includes("?")?"&":"?";
  return s?getPluginApiBase()+path+sep+s:getPluginApiBase()+path;
}

async function api(path,init){
  var token=getToken();
  var r=await fetch(buildApiUrl(path),{credentials:"include",...init,headers:{"content-type":"application/json",...(token?{Authorization:"Bearer "+token}:{}),
    ...(init&&init.headers?init.headers:{})}});
  var d=await r.json().catch(function(){return null});
  if(!r.ok)throw new Error(d&&d.error?d.error.message||d.error.code:"Request failed");
  return d&&d.data!==undefined?d.data:d;
}

async function platformApi(path,init){
  var token=getToken();
  var r=await fetch(path,{credentials:"include",...init,headers:{"content-type":"application/json",
    ...(token?{Authorization:"Bearer "+token}:{}),
    ...(init&&init.headers?init.headers:{})}});
  var d=await r.json().catch(function(){return null});
  if(!r.ok)throw new Error(d&&d.error?d.error.message||d.error.code:"Request failed");
  return d&&d.data!==undefined?d.data:d;
}

function showMsg(id,text,type){
  var el=document.getElementById(id);
  if(el)el.innerHTML=text?'<div class="msg msg-'+(type||"ok")+'">'+escHtml(text)+'</div>':"";
}
function escHtml(s){return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;")}

// ============================================================================
// Tabs
// ============================================================================
document.querySelectorAll(".tab").forEach(function(btn){
  btn.addEventListener("click",function(){
    document.querySelectorAll(".tab").forEach(function(t){t.classList.remove("active")});
    document.querySelectorAll(".tab-content").forEach(function(c){c.classList.remove("active")});
    btn.classList.add("active");
    document.getElementById("tab-"+btn.dataset.tab).classList.add("active");
  });
});

// ============================================================================
// Languages Tab
// ============================================================================
var languages=[];

async function loadLanguages(){
  try{
    languages=await api("/languages")||[];
    renderLanguages();
    populateLocaleSelectors();
  }catch(e){showMsg("lang-msg",e.message,"err")}
}

function renderLanguages(){
  var body=document.getElementById("lang-body");
  if(!languages.length){body.innerHTML='<tr><td colspan="6" style="color:var(--muted)">No languages configured</td></tr>';return}
  body.innerHTML=languages.map(function(l){
    var status=l.isDefault?'<span class="badge badge-default">Default</span>':
      l.isEnabled?'<span class="badge badge-ok">Enabled</span>':'<span class="badge badge-warn">Disabled</span>';
    return '<tr><td><strong>'+escHtml(l.locale)+'</strong></td><td>'+escHtml(l.name)+'</td><td>'+escHtml(l.nativeName)+'</td>'+
      '<td>'+(l.fallbackTo||"-")+'</td><td>'+status+'</td>'+
      '<td>'+(l.isDefault?'':'<button class="btn btn-danger btn-sm" onclick="deleteLang(\''+escHtml(l.locale)+'\')">Delete</button>')+'</td></tr>';
  }).join("");
}

function populateLocaleSelectors(){
  var nonDefault=languages.filter(function(l){return!l.isDefault&&l.isEnabled});
  var opts=nonDefault.map(function(l){return'<option value="'+escHtml(l.locale)+'">'+escHtml(l.name)+" ("+escHtml(l.locale)+")</option>"}).join("");
  document.getElementById("ct-locale").innerHTML=opts;
  document.getElementById("ui-locale").innerHTML=opts;
}

document.getElementById("lang-form").addEventListener("submit",async function(e){
  e.preventDefault();
  try{
    await api("/languages",{method:"POST",body:JSON.stringify({
      locale:document.getElementById("lf-locale").value.trim(),
      name:document.getElementById("lf-name").value.trim(),
      nativeName:document.getElementById("lf-native").value.trim(),
      fallbackTo:document.getElementById("lf-fallback").value.trim()||null,
      isEnabled:true
    })});
    showMsg("lang-msg","Language added","ok");
    document.getElementById("lang-form").reset();
    await loadLanguages();
  }catch(e){showMsg("lang-msg",e.message,"err")}
});

async function deleteLang(locale){
  if(!confirm("Delete language: "+locale+"?"))return;
  try{
    await api("/languages/"+encodeURIComponent(locale),{method:"DELETE"});
    showMsg("lang-msg","Language deleted","ok");
    await loadLanguages();
  }catch(e){showMsg("lang-msg",e.message,"err")}
}

// ============================================================================
// Content Translation Tab
// ============================================================================
var entityCache=[];
var selectedEntity=null;

async function loadEntities(){
  var type=document.getElementById("ct-type").value;
  var locale=document.getElementById("ct-locale").value;
  if(!locale){alert("Select a target language first");return}

  try{
    if(type==="product"){
      var data=await platformApi("/api/admin/products?page=1&limit=200");
      entityCache=(data.items||data||[]).map(function(p){return{id:p.id,name:p.name,description:p.description||"",fields:{name:p.name,description:p.description||""}}});
    }else if(type==="category"){
      var data=await platformApi("/api/products/categories?page=1&limit=200");
      entityCache=(data.items||data||[]).map(function(c){return{id:c.id,name:c.name,fields:{name:c.name}}});
    }
    renderEntityList();
  }catch(e){
    document.getElementById("ct-entities").innerHTML='<div style="padding:20px;color:var(--danger)">'+escHtml(e.message)+'</div>';
  }
}

function renderEntityList(){
  var container=document.getElementById("ct-entities");
  if(!entityCache.length){container.innerHTML='<div style="padding:20px;color:var(--muted);text-align:center">No items found</div>';return}
  container.innerHTML=entityCache.map(function(e){
    return'<div class="entity-item" data-id="'+escHtml(e.id)+'" onclick="selectEntity(\''+escHtml(e.id)+'\')">'
      +'<span>'+escHtml(e.name)+'</span></div>';
  }).join("");
}

function filterEntities(){
  var q=document.getElementById("ct-search").value.toLowerCase();
  document.querySelectorAll(".entity-item").forEach(function(el){
    el.style.display=el.textContent.toLowerCase().includes(q)?"":"none";
  });
}

async function selectEntity(id){
  selectedEntity=entityCache.find(function(e){return e.id===id});
  if(!selectedEntity)return;

  document.querySelectorAll(".entity-item").forEach(function(el){el.classList.toggle("active",el.dataset.id===id)});

  var type=document.getElementById("ct-type").value;
  var locale=document.getElementById("ct-locale").value;
  var existing={};

  try{existing=await api("/content/"+type+"/"+id+"/"+locale)||{}}catch(e){}

  var fields=Object.keys(selectedEntity.fields);
  var html='<div class="editor-grid">'
    +'<div class="editor-col"><h3>Source (Default Language)</h3>'
    +fields.map(function(f){
      return'<div class="editor-field"><label>'+escHtml(f)+'</label><div class="source-text">'+escHtml(selectedEntity.fields[f]||"")+'</div></div>';
    }).join("")
    +'</div>'
    +'<div class="editor-col"><h3>Translation ('+escHtml(locale)+')</h3>'
    +fields.map(function(f){
      var val=existing[f]||"";
      if(f==="description"){
        return'<div class="editor-field"><label>'+escHtml(f)+'</label><textarea id="ct-field-'+escHtml(f)+'" placeholder="Enter translation...">'+escHtml(val)+'</textarea></div>';
      }
      return'<div class="editor-field"><label>'+escHtml(f)+'</label><input id="ct-field-'+escHtml(f)+'" value="'+escHtml(val)+'" placeholder="Enter translation..."/></div>';
    }).join("")
    +'</div></div>'
    +'<div id="ct-msg" style="margin-top:10px"></div>'
    +'<div style="margin-top:14px;display:flex;gap:8px">'
    +'<button class="btn btn-primary" onclick="saveContentTranslation()">Save Translation</button>'
    +'<button class="btn btn-danger" onclick="deleteContentTranslation()">Clear</button>'
    +'</div>';

  document.getElementById("ct-editor-content").innerHTML=html;
}

async function saveContentTranslation(){
  if(!selectedEntity)return;
  var type=document.getElementById("ct-type").value;
  var locale=document.getElementById("ct-locale").value;
  var fields={};

  Object.keys(selectedEntity.fields).forEach(function(f){
    var el=document.getElementById("ct-field-"+f);
    if(el&&el.value.trim())fields[f]=el.value.trim();
  });

  if(!Object.keys(fields).length){showMsg("ct-msg","Enter at least one translation","err");return}

  try{
    await api("/content/"+type+"/"+selectedEntity.id+"/"+locale,{method:"PUT",body:JSON.stringify({fields:fields})});
    showMsg("ct-msg","Saved","ok");
  }catch(e){showMsg("ct-msg",e.message,"err")}
}

async function deleteContentTranslation(){
  if(!selectedEntity)return;
  var type=document.getElementById("ct-type").value;
  var locale=document.getElementById("ct-locale").value;
  if(!confirm("Clear all translations for this item in "+locale+"?"))return;
  try{
    await api("/content/"+type+"/"+selectedEntity.id+"?locale="+encodeURIComponent(locale),{method:"DELETE"});
    showMsg("ct-msg","Cleared","ok");
    selectEntity(selectedEntity.id);
  }catch(e){showMsg("ct-msg",e.message,"err")}
}

// ============================================================================
// UI Strings Tab
// ============================================================================
var uiSourceKeys={};
var uiTranslations={};

async function loadUIStrings(){
  var ns=document.getElementById("ui-ns").value;
  var locale=document.getElementById("ui-locale").value;
  if(!locale){alert("Select a target language first");return}

  try{
    var defaultLang=languages.find(function(l){return l.isDefault});
    if(defaultLang){
      var defaultStrings=await api("/ui/"+defaultLang.locale+"/"+ns).catch(function(){return{}});
      uiSourceKeys=defaultStrings||{};
    }
    uiTranslations=await api("/ui/"+locale+"/"+ns)||{};
    renderUIStrings();
  }catch(e){showMsg("ui-msg",e.message,"err")}
}

function renderUIStrings(){
  var body=document.getElementById("ui-body");
  var allKeys=new Set(Object.keys(uiSourceKeys).concat(Object.keys(uiTranslations)));
  var keys=Array.from(allKeys).sort();

  if(!keys.length){
    body.innerHTML='<tr><td colspan="3" style="color:var(--muted)">No strings found. Add translations using the input below.</td></tr>'
      +'<tr><td><input id="ui-new-key" placeholder="key.path" style="width:100%"/></td>'
      +'<td style="color:var(--muted)">-</td>'
      +'<td><input id="ui-new-val" placeholder="Translation" style="width:100%"/></td></tr>';
    document.getElementById("ui-save-btn").disabled=false;
    return;
  }

  body.innerHTML=keys.map(function(k){
    var src=uiSourceKeys[k]||"";
    var trans=uiTranslations[k]||"";
    return'<tr data-key="'+escHtml(k)+'"><td style="font-family:monospace;font-size:12px;word-break:break-all">'+escHtml(k)+'</td>'
      +'<td style="color:var(--muted);font-size:13px">'+escHtml(src)+'</td>'
      +'<td><input class="ui-trans-input" data-key="'+escHtml(k)+'" value="'+escHtml(trans)+'" placeholder="Enter translation..." style="width:100%;padding:6px 10px;border:1px solid var(--line);border-radius:8px;font:inherit"/></td></tr>';
  }).join("")
    +'<tr style="border-top:2px solid var(--line)"><td><input id="ui-new-key" placeholder="+ new key" style="width:100%;padding:6px 10px;border:1px solid var(--line);border-radius:8px;font:inherit;font-family:monospace;font-size:12px"/></td>'
    +'<td></td>'
    +'<td><input id="ui-new-val" placeholder="Translation" style="width:100%;padding:6px 10px;border:1px solid var(--line);border-radius:8px;font:inherit"/></td></tr>';

  document.getElementById("ui-save-btn").disabled=false;
}

function filterUIKeys(){
  var q=document.getElementById("ui-search").value.toLowerCase();
  document.querySelectorAll("#ui-body tr").forEach(function(tr){
    var key=tr.dataset.key||"";
    tr.style.display=(!q||key.toLowerCase().includes(q)||tr.textContent.toLowerCase().includes(q))?"":"none";
  });
}

async function saveUIStrings(){
  var ns=document.getElementById("ui-ns").value;
  var locale=document.getElementById("ui-locale").value;
  if(!locale)return;

  var entries={};
  document.querySelectorAll(".ui-trans-input").forEach(function(input){
    var k=input.dataset.key;
    var v=input.value.trim();
    if(k&&v)entries[k]=v;
  });

  var newKey=(document.getElementById("ui-new-key")||{}).value||"";
  var newVal=(document.getElementById("ui-new-val")||{}).value||"";
  if(newKey.trim()&&newVal.trim())entries[newKey.trim()]=newVal.trim();

  if(!Object.keys(entries).length){showMsg("ui-msg","Nothing to save","err");return}

  try{
    await api("/ui/"+locale+"/"+ns,{method:"PUT",body:JSON.stringify(entries)});
    showMsg("ui-msg","Saved "+Object.keys(entries).length+" translations","ok");
    await loadUIStrings();
  }catch(e){showMsg("ui-msg",e.message,"err")}
}

// ============================================================================
// Init
// ============================================================================
loadLanguages();
</script>
</body>
</html>`;
}
