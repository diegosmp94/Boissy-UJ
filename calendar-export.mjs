/** Public calendar export. Only receives entries filtered from published data by agenda.mjs.
 * No network calls, account identifiers, cookies, private roster or backend writes.
 */
const CRLF='\r\n';
const exportedUrl='https://diegosmp94.github.io/Boissy-UJ/#/agenda';
const dateUtc=value=>new Date(value).toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'');
export function escapeCalendarText(value){
  return String(value??'').replace(/\r\n?/g,'\n')
    .replace(/[\u0000-\u0009\u000b-\u001f\u007f-\u009f]/g,'')
    .replace(/\\/g,'\\\\').replace(/;/g,'\\;').replace(/,/g,'\\,').replace(/\n/g,'\\n');
}
/** RFC 5545 folding: count UTF-8 bytes, never cut a multi-byte code point. */
export function foldCalendarLine(line){
  const out=[];let current='',size=0;
  const encoder=new TextEncoder();
  for(const char of String(line)){
    const count=encoder.encode(char).byteLength;
    if(size+count>75&&current){
      out.push(current);
      current=' '+char;
      size=1+count;
    }else{
      current+=char;
      size+=count;
    }
  }
  out.push(current);
  return out.join(CRLF);
}
export function buildPublicCalendar(entries,{now=Date.now()}={}){
  if(!Array.isArray(entries))throw new TypeError('Liste de dates invalide');
  if(!Number.isFinite(now))throw new TypeError('Heure invalide');
  const lines=['BEGIN:VCALENDAR','VERSION:2.0',
    'PRODID:-//Boissy-UJ//Calendrier public//FR',
    'CALSCALE:GREGORIAN','METHOD:PUBLISH',
    'X-WR-CALNAME:'+escapeCalendarText('Boissy-UJ — Agenda public')
  ];
  let total=0;
  for(const item of entries){
    if(!item||!['match','event'].includes(item.kind))continue;
    const id=String(item.id??'');
    const time=Number(item.time);
    if(!/^[a-zA-Z0-9-]{1,80}$/.test(id)||!Number.isFinite(time)||
      Number.isNaN(new Date(time).valueOf())||!String(item.title||'').trim())continue;
    total++;
    lines.push('BEGIN:VEVENT',
      'UID:'+item.kind+'-'+id+'@boissy-uj',
      'DTSTAMP:'+dateUtc(now),
      'DTSTART:'+dateUtc(time));
    const end=Number(item.endsAt);
    if(item.kind==='event'&&item.endsAt!==null&&item.endsAt!==undefined&&
       Number.isFinite(end)&&end>time){
      lines.push('DTEND:'+dateUtc(end));
    }
    lines.push('SUMMARY:'+escapeCalendarText(String(item.title).slice(0,200)));
    if(item.place)lines.push('LOCATION:'+escapeCalendarText(String(item.place).slice(0,200)));
    const info=[item.subtitle,item.info].filter(Boolean).join(' — ');
    if(info)lines.push('DESCRIPTION:'+escapeCalendarText(info.slice(0,300)));
    lines.push('URL:'+exportedUrl,'END:VEVENT');
  }
  if(!total)throw new Error('Aucun rendez-vous public à exporter');
  lines.push('END:VCALENDAR');
  return lines.map(foldCalendarLine).join(CRLF)+CRLF;
}
