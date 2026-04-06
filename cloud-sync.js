/**
 * SWI Foods — QA Receiving Cloud Sync
 * ใส่ URL Worker ของคุณใน API_BASE หลัง deploy แล้ว
 */

// ── ตั้งค่า URL ของ Worker ──────────────────────────────────────────────
// เปลี่ยนเป็น URL จริงของ Worker หลัง deploy เช่น:
// const API_BASE = 'https://qa-receiving-api.YOUR_SUBDOMAIN.workers.dev'
const API_BASE = '';  // ← ใส่ URL ที่นี่

const SYNC_KEY  = 'qa_sync_queue';   // localStorage queue สำหรับ offline
const SYNC_FLAG = 'qa_cloud_enabled';

// ─────────────────────────────────────────────────────────────────────────
const cloudEnabled = () => !!API_BASE && navigator.onLine;

// ── Save a full receiving record to cloud ─────────────────────────────────
async function cloudSaveRecord(rec) {
  if (!cloudEnabled()) { queueRecord(rec); return false; }
  try {
    const sp = (typeof SUPPLIERS !== 'undefined')
      ? SUPPLIERS.find(s => s.id === rec.supplier) || {}
      : {};
    const mats = rec.materials || rec.mats || [];
    const allPass = mats.every(m => m.result === 'PASS');
    const hasRej  = mats.some(m => m.result === 'REJECT');

    const payload = {
      header: {
        doc_no:           rec.docNo,
        date:             rec.date,
        time:             rec.time || '',
        supplier_id:      rec.supplier || '',
        supplier_name:    sp.name || rec.supplier || '',
        car_registration: rec.carReg || '',
        car_temp:         rec.carTemp ?? null,
        qa_inspector:     rec.inspector || '',
        note:             rec.note || '',
        signer_name:      rec.sig?.signerName || '',
        signed_at:        rec.sig?.signedAt || '',
        overall_result:   allPass ? 'PASS' : hasRej ? 'REJECT' : 'HOLD',
      },
      details: mats.map((m, i) => {
        const temps = [m.t1, m.t2, m.t3].map(Number).filter(t => !isNaN(t));
        const avg   = temps.length ? +(temps.reduce((a,b)=>a+b,0)/temps.length).toFixed(1) : null;
        const mi    = (typeof MATERIALS !== 'undefined')
          ? MATERIALS.find(x => x.code === m.code) || {}
          : {};
        let tempStatus = '';
        if (temps.length && mi.minTemp != null)
          tempStatus = temps.every(t => t >= mi.minTemp && t <= mi.maxTemp) ? 'PASS' : 'FAIL';
        if (temps.length && mi.minT != null)
          tempStatus = temps.every(t => t >= mi.minT && t <= mi.maxT) ? 'PASS' : 'FAIL';
        return {
          material_code:  m.code || '',
          material_name:  m.name || mi.name || '',
          material_type:  m.type || mi.type || '',
          lot_no:         m.lot || '',
          qty:            parseFloat(m.qty) || null,
          unit:           m.unit || '',
          mfg_date:       m.mfg || '',
          exp_date:       m.exp || '',
          temp1:          m.t1 != null && m.t1 !== '' ? parseFloat(m.t1) : null,
          temp2:          m.t2 != null && m.t2 !== '' ? parseFloat(m.t2) : null,
          temp3:          m.t3 != null && m.t3 !== '' ? parseFloat(m.t3) : null,
          avg_temp:       avg,
          temp_status:    tempStatus,
          visual_check:   m.visual || '',
          leak_check:     m.leak || 'N/A',
          document_check: m.doc || '',
          result:         m.result || '',
          note:           m.note || '',
          photo1:         m.photo1 || null,
          photo2:         m.photo2 || null,
        };
      }),
      signature: rec.sig ? {
        signer_name: rec.sig.signerName || '',
        signed_at:   rec.sig.signedAt || '',
        sig_base64:  rec.sig.sigBase64 || '',
      } : null,
      ncLogs: [],
    };

    const res = await fetch(`${API_BASE}/api/receiving`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (data.success) {
      showCloudStatus('✓ บันทึกลง Cloud เรียบร้อย', 'ok');
      flushQueue(); // try to flush any queued records
      return true;
    } else {
      throw new Error(data.error || 'Unknown error');
    }
  } catch (err) {
    console.warn('[Cloud] Save failed:', err.message);
    queueRecord(rec);
    showCloudStatus('⚠ Offline — บันทึกใน Queue แล้ว', 'warn');
    return false;
  }
}

// ── Save NC ───────────────────────────────────────────────────────────────
async function cloudSaveNC(nc) {
  if (!cloudEnabled()) return false;
  try {
    const res = await fetch(`${API_BASE}/api/nc`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nc_id:             nc.id,
        doc_no:            nc.docNo,
        supplier_id:       nc.supplier || '',
        supplier_name:     nc.supplierName || '',
        fail_type:         nc.failType,
        corrective_action: nc.corrective || '—',
        qa_supervisor:     nc.qa || '',
        status:            nc.status || 'Open',
        closed_date:       nc.closedDate || null,
        note:              nc.note || '',
      }),
    });
    return (await res.json()).success;
  } catch (err) { return false; }
}

// ── Close NC in cloud ──────────────────────────────────────────────────────
async function cloudCloseNC(id, data) {
  if (!cloudEnabled()) return false;
  try {
    const res = await fetch(`${API_BASE}/api/nc/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return (await res.json()).success;
  } catch (err) { return false; }
}

// ── Fetch all records from cloud ───────────────────────────────────────────
async function cloudFetchAll(opts = {}) {
  if (!API_BASE) return null;
  try {
    const params = new URLSearchParams();
    if (opts.from) params.set('from', opts.from);
    if (opts.to)   params.set('to', opts.to);
    const res = await fetch(`${API_BASE}/api/receiving?${params}`);
    return await res.json();
  } catch (err) { return null; }
}

// ── Fetch NC from cloud ────────────────────────────────────────────────────
async function cloudFetchNC() {
  if (!API_BASE) return null;
  try {
    const res = await fetch(`${API_BASE}/api/nc`);
    return await res.json();
  } catch (err) { return null; }
}

// ── Export JSON from cloud (for Excel) ────────────────────────────────────
async function cloudExportData(opts = {}) {
  if (!API_BASE) return null;
  try {
    const params = new URLSearchParams();
    if (opts.from) params.set('from', opts.from);
    if (opts.to)   params.set('to', opts.to);
    const res = await fetch(`${API_BASE}/api/export?${params}`);
    return await res.json();
  } catch (err) { return null; }
}

// ── Offline queue (localStorage) ──────────────────────────────────────────
function queueRecord(rec) {
  try {
    const q = JSON.parse(localStorage.getItem(SYNC_KEY) || '[]');
    q.push({ rec, ts: Date.now() });
    localStorage.setItem(SYNC_KEY, JSON.stringify(q));
  } catch (e) {}
}

async function flushQueue() {
  if (!cloudEnabled()) return;
  try {
    const q = JSON.parse(localStorage.getItem(SYNC_KEY) || '[]');
    if (q.length === 0) return;
    const remaining = [];
    for (const item of q) {
      const ok = await cloudSaveRecord(item.rec);
      if (!ok) remaining.push(item);
    }
    localStorage.setItem(SYNC_KEY, JSON.stringify(remaining));
    if (remaining.length < q.length)
      showCloudStatus(`✓ Sync Queue: ${q.length - remaining.length} รายการ`, 'ok');
  } catch (e) {}
}

// ── Cloud status indicator ─────────────────────────────────────────────────
function showCloudStatus(msg, type = '') {
  let el = document.getElementById('cloud-status-bar');
  if (!el) {
    el = document.createElement('div');
    el.id = 'cloud-status-bar';
    el.style.cssText = `
      position:fixed;bottom:70px;left:50%;transform:translateX(-50%);
      background:#0f2744;color:#fff;padding:7px 18px;border-radius:20px;
      font-size:12px;font-weight:600;z-index:500;
      opacity:0;transition:.25s;pointer-events:none;white-space:nowrap;
    `;
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.style.background = type === 'ok' ? '#0d7a5f' : type === 'warn' ? '#e8900a' : '#0f2744';
  el.style.opacity = '1';
  setTimeout(() => { el.style.opacity = '0'; }, 3000);
}

// ── Cloud indicator in header (optional) ──────────────────────────────────
function initCloudIndicator() {
  if (!API_BASE) return;
  const badge = document.createElement('div');
  badge.id = 'cloud-badge';
  badge.innerHTML = API_BASE
    ? '☁ Cloud เชื่อมต่อแล้ว'
    : '☁ Cloud (ไม่ได้ตั้งค่า)';
  badge.style.cssText = `
    position:fixed;top:4px;right:12px;font-size:10px;font-weight:600;
    padding:3px 9px;border-radius:10px;z-index:200;
    background:${API_BASE ? 'rgba(29,158,117,.15)' : 'rgba(200,200,200,.15)'};
    color:${API_BASE ? '#5dca9e' : '#9aa0ab'};
  `;
  document.body.appendChild(badge);

  // Flush queue on load and when coming online
  window.addEventListener('online', flushQueue);
  setTimeout(flushQueue, 2000);
}

// ── Auto-init ──────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', initCloudIndicator);
