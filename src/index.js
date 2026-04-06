/**
 * SWI Foods — Smart QA Factory
 * QA Receiving API  |  FM-QA-31 / SD-QA-08
 * Pure Cloudflare Worker — wrangler deploy ได้เลย ไม่ต้อง npm install
 */

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json;charset=utf-8',
}

const ok  = (d, s=200) => new Response(JSON.stringify(d), {status:s, headers:CORS})
const err = (m, s=400) => ok({success:false, error:m}, s)
const safe = v => String(v||'').replace(/'/g,"''")

export default {
  async fetch(req, env) {
    const url  = new URL(req.url)
    const path = url.pathname.replace(/\/+$/,'') || '/'
    const method = req.method.toUpperCase()
    const DB = env.DB

    if (method === 'OPTIONS')
      return new Response(null, {status:204, headers:CORS})

    try {

      /* ── Health ──────────────────────────────────────────────────── */
      if (path==='/' || path==='/api/health')
        return ok({service:'SWI Foods QA Receiving API',form:'FM-QA-31',
                   ref:'SD-QA-08',db:'qa-factory-db',status:'ok',
                   ts:new Date().toISOString()})

      /* ═══════════════════════════════════════════════════════════════
         POST /api/receiving — บันทึกการรับวัตถุดิบ
      ═══════════════════════════════════════════════════════════════ */
      if (path==='/api/receiving' && method==='POST') {
        const {header,details,signature,ncLogs} = await req.json()
        if (!header?.doc_no||!header?.date) return err('Missing doc_no or date')

        const now = new Date().toISOString()

        await DB.prepare(`INSERT INTO receiving_header
          (doc_no,date,time,supplier_id,supplier_name,car_registration,car_temp,
           qa_inspector,note,signer_name,signed_at,overall_result,created_at)
          VALUES(?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13)
          ON CONFLICT(doc_no) DO UPDATE SET
            date=?2,time=?3,supplier_id=?4,supplier_name=?5,
            car_registration=?6,car_temp=?7,qa_inspector=?8,note=?9,
            signer_name=?10,signed_at=?11,overall_result=?12`)
          .bind(header.doc_no,header.date,header.time??null,
                header.supplier_id??null,header.supplier_name??null,
                header.car_registration??null,header.car_temp??null,
                header.qa_inspector??null,header.note??null,
                header.signer_name??null,header.signed_at??null,
                header.overall_result??null,now).run()

        if (Array.isArray(details)) {
          for (let i=0;i<details.length;i++) {
            const d=details[i]
            const id=`${header.doc_no}_${String(i+1).padStart(2,'0')}`
            const ts=[d.temp1,d.temp2,d.temp3].map(Number).filter(t=>!isNaN(t))
            const avg=ts.length?parseFloat((ts.reduce((a,b)=>a+b,0)/ts.length).toFixed(1)):null
            await DB.prepare(`INSERT INTO receiving_detail
              (detail_id,doc_no,date,supplier_name,material_code,material_name,
               material_type,lot_no,qty,unit,mfg_date,exp_date,
               temp1,temp2,temp3,avg_temp,temp_status,
               visual_check,leak_check,document_check,result,note,photo1,photo2,created_at)
              VALUES(?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15,?16,?17,?18,?19,?20,?21,?22,?23,?24,?25)
              ON CONFLICT(detail_id) DO UPDATE SET
                lot_no=?8,qty=?9,unit=?10,mfg_date=?11,exp_date=?12,
                temp1=?13,temp2=?14,temp3=?15,avg_temp=?16,temp_status=?17,
                visual_check=?18,leak_check=?19,document_check=?20,
                result=?21,note=?22,photo1=?23,photo2=?24`)
              .bind(id,header.doc_no,header.date,header.supplier_name??null,
                    d.material_code??null,d.material_name??null,
                    d.material_type??null,d.lot_no??null,
                    d.qty??null,d.unit??null,d.mfg_date??null,d.exp_date??null,
                    d.temp1??null,d.temp2??null,d.temp3??null,avg,d.temp_status??null,
                    d.visual_check??null,d.leak_check??null,d.document_check??null,
                    d.result??null,d.note??null,
                    d.photo1?d.photo1.slice(0,409600):null,
                    d.photo2?d.photo2.slice(0,409600):null,now).run()
          }
        }

        if (signature?.sig_base64) {
          await DB.prepare(`INSERT INTO signatures(doc_no,signer_name,signed_at,sig_base64,created_at)
            VALUES(?1,?2,?3,?4,?5)
            ON CONFLICT(doc_no) DO UPDATE SET signer_name=?2,signed_at=?3,sig_base64=?4`)
            .bind(header.doc_no,signature.signer_name??null,signature.signed_at??null,
                  signature.sig_base64.slice(0,204800),now).run()
        }

        if (Array.isArray(ncLogs)) {
          for (const nc of ncLogs) {
            await DB.prepare(`INSERT OR IGNORE INTO nc_log
              (nc_id,doc_no,supplier_id,supplier_name,fail_type,corrective_action,
               qa_supervisor,status,closed_date,note,created_at)
              VALUES(?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11)`)
              .bind(nc.nc_id,nc.doc_no,nc.supplier_id??null,nc.supplier_name??null,
                    nc.fail_type,nc.corrective_action??'—',nc.qa_supervisor??null,
                    nc.status??'Open',nc.closed_date??null,nc.note??null,now).run()
          }
        }

        return ok({success:true,doc_no:header.doc_no,saved_at:now})
      }

      /* ── GET /api/receiving ─────────────────────────────────────── */
      if (path==='/api/receiving' && method==='GET') {
        const from=url.searchParams.get('from')||''
        const to=url.searchParams.get('to')||''
        const sp=url.searchParams.get('supplier')||''
        const lim=Math.min(parseInt(url.searchParams.get('limit')||'200'),500)

        let w='WHERE 1=1'
        if(from) w+=` AND h.date>='${safe(from)}'`
        if(to)   w+=` AND h.date<='${safe(to)}'`
        if(sp)   w+=` AND (h.supplier_id='${safe(sp)}' OR h.supplier_name LIKE '%${safe(sp)}%')`

        const headers=await DB.prepare(
          `SELECT h.*,s.signer_name as sig_name,s.signed_at as sig_at
           FROM receiving_header h LEFT JOIN signatures s ON h.doc_no=s.doc_no
           ${w} ORDER BY h.date DESC,h.time DESC LIMIT ${lim}`).all()

        const result=await Promise.all(headers.results.map(async h=>{
          const dets=await DB.prepare(
            `SELECT detail_id,doc_no,material_code,material_name,material_type,lot_no,
                    qty,unit,mfg_date,exp_date,temp1,temp2,temp3,avg_temp,temp_status,
                    visual_check,leak_check,document_check,result,note
             FROM receiving_detail WHERE doc_no=?1 ORDER BY detail_id`).bind(h.doc_no).all()
          return {...h, details:dets.results}
        }))

        return ok({success:true,count:result.length,data:result})
      }

      /* ── GET /api/receiving/:docNo ──────────────────────────────── */
      const rMatch=path.match(/^\/api\/receiving\/(.+)$/)
      if(rMatch && method==='GET') {
        const docNo=decodeURIComponent(rMatch[1])
        const h=await DB.prepare(
          `SELECT h.*,s.signer_name,s.signed_at FROM receiving_header h
           LEFT JOIN signatures s ON h.doc_no=s.doc_no WHERE h.doc_no=?1`).bind(docNo).first()
        if(!h) return err('Not found',404)
        const d=await DB.prepare(`SELECT * FROM receiving_detail WHERE doc_no=?1 ORDER BY detail_id`).bind(docNo).all()
        return ok({success:true,data:{...h,details:d.results}})
      }

      /* ═══════════════════════════════════════════════════════════════
         NC LOG
      ═══════════════════════════════════════════════════════════════ */
      if(path==='/api/nc' && method==='GET') {
        const st=url.searchParams.get('status')||''
        const w=st?`WHERE status='${safe(st)}'`:''
        const rows=await DB.prepare(`SELECT * FROM nc_log ${w} ORDER BY created_at DESC LIMIT 500`).all()
        return ok({success:true,count:rows.results.length,data:rows.results})
      }

      if(path==='/api/nc' && method==='POST') {
        const nc=await req.json()
        if(!nc.nc_id||!nc.fail_type) return err('Missing nc_id or fail_type')
        await DB.prepare(`INSERT OR REPLACE INTO nc_log
          (nc_id,doc_no,supplier_id,supplier_name,fail_type,corrective_action,
           qa_supervisor,status,closed_date,note,created_at)
          VALUES(?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11)`)
          .bind(nc.nc_id,nc.doc_no??null,nc.supplier_id??null,nc.supplier_name??null,
                nc.fail_type,nc.corrective_action??'—',nc.qa_supervisor??null,
                nc.status??'Open',nc.closed_date??null,nc.note??null,
                new Date().toISOString()).run()
        return ok({success:true,nc_id:nc.nc_id})
      }

      const ncMatch=path.match(/^\/api\/nc\/(.+)$/)
      if(ncMatch && method==='PATCH') {
        const id=decodeURIComponent(ncMatch[1])
        const b=await req.json()
        await DB.prepare(
          `UPDATE nc_log SET status=?1,closed_date=?2,corrective_action=COALESCE(?3,corrective_action) WHERE nc_id=?4`)
          .bind(b.status??'Closed',b.closed_date??new Date().toISOString().split('T')[0],
                b.corrective_action??null,id).run()
        return ok({success:true})
      }

      /* ── STATS ──────────────────────────────────────────────────── */
      if(path==='/api/stats' && method==='GET') {
        const [tot,ncO,nc7,h7,byR]=await Promise.all([
          DB.prepare(`SELECT COUNT(*) n FROM receiving_header`).first(),
          DB.prepare(`SELECT COUNT(*) n FROM nc_log WHERE status='Open'`).first(),
          DB.prepare(`SELECT COUNT(*) n FROM nc_log WHERE created_at>=datetime('now','-7 days')`).first(),
          DB.prepare(`SELECT COUNT(*) n FROM receiving_header WHERE date>=date('now','-7 days')`).first(),
          DB.prepare(`SELECT result,COUNT(*) n FROM receiving_detail GROUP BY result`).all(),
        ])
        const rm={}; byR.results.forEach(r=>{rm[r.result]=r.n})
        return ok({success:true,stats:{
          total_receiving:tot.n, nc_open:ncO.n,
          nc_last_7d:nc7.n, receiving_last_7d:h7.n, by_result:rm
        }})
      }

      /* ── EXPORT JSON (for client Excel) ─────────────────────────── */
      if(path==='/api/export' && method==='GET') {
        const from=url.searchParams.get('from')||''
        const to=url.searchParams.get('to')||''
        let w='WHERE 1=1'
        if(from) w+=` AND h.date>='${safe(from)}'`
        if(to)   w+=` AND h.date<='${safe(to)}'`

        const [H,D,N]=await Promise.all([
          DB.prepare(`SELECT h.*,s.signer_name sig_name,s.signed_at sig_at
            FROM receiving_header h LEFT JOIN signatures s ON h.doc_no=s.doc_no
            ${w} ORDER BY h.date DESC,h.time DESC LIMIT 1000`).all(),
          DB.prepare(`SELECT d.detail_id,d.doc_no,d.date,d.supplier_name,
            d.material_code,d.material_name,d.material_type,d.lot_no,
            d.qty,d.unit,d.mfg_date,d.exp_date,d.temp1,d.temp2,d.temp3,
            d.avg_temp,d.temp_status,d.visual_check,d.leak_check,d.document_check,
            d.result,d.note
            FROM receiving_detail d JOIN receiving_header h ON d.doc_no=h.doc_no
            ${w} ORDER BY d.doc_no,d.detail_id`).all(),
          DB.prepare(`SELECT * FROM nc_log ORDER BY created_at DESC`).all(),
        ])

        return ok({success:true,exported_at:new Date().toISOString(),
          headers:H.results, details:D.results, nc_logs:N.results})
      }

      return err(`Not found: ${method} ${path}`,404)

    } catch(e) {
      console.error('[QA API]',e)
      return err(e.message||'Internal error',500)
    }
  }
}
