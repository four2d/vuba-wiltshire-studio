/* FOXON Studio scheduling time helpers. Pure functions, shared by the browser UI and tests.
   All schedule times are entered as UK wall-clock time (Europe/London) and stored as UTC. */
export const UK_TIME_ZONE="Europe/London";
export const DEFAULT_UK_TIME="07:30";
export const MIN_LEAD_MINUTES=5;
export const MAX_DAYS_AHEAD=90;
function zoneOffsetMs(utcMs,timeZone=UK_TIME_ZONE){
 const parts=Object.fromEntries(new Intl.DateTimeFormat("en-GB",{timeZone,hourCycle:"h23",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",second:"2-digit"}).formatToParts(new Date(utcMs)).map(p=>[p.type,p.value]));
 const asUtc=Date.UTC(+parts.year,+parts.month-1,+parts.day,+parts.hour,+parts.minute,+parts.second);
 return asUtc-Math.floor(utcMs/1000)*1000;
}
/** Convert a UK date ("YYYY-MM-DD") and time ("HH:MM") to a UTC ISO string.
    Returns null for invalid input or for wall-clock times that do not exist (spring-forward gap). */
export function ukLocalToUtcIso(date,time=DEFAULT_UK_TIME){
 const d=/^(\d{4})-(\d{2})-(\d{2})$/.exec(String(date||"")),t=/^([01]\d|2[0-3]):([0-5]\d)$/.exec(String(time||""));
 if(!d||!t)return null;
 const [y,mo,da,h,mi]=[+d[1],+d[2],+d[3],+t[1],+t[2]];
 const guess=Date.UTC(y,mo-1,da,h,mi);
 const check=new Date(guess);if(check.getUTCFullYear()!==y||check.getUTCMonth()!==mo-1||check.getUTCDate()!==da)return null;
 let utc=guess-zoneOffsetMs(guess);
 utc=guess-zoneOffsetMs(utc);
 const back=utcIsoToUkParts(new Date(utc).toISOString());
 if(back.date!==date||back.time!==time)return null;
 return new Date(utc).toISOString();
}
/** Split a UTC ISO time into UK date/time strings for form inputs and display. */
export function utcIsoToUkParts(iso){
 const parts=Object.fromEntries(new Intl.DateTimeFormat("en-GB",{timeZone:UK_TIME_ZONE,hourCycle:"h23",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit"}).formatToParts(new Date(iso)).map(p=>[p.type,p.value]));
 return {date:parts.year+"-"+parts.month+"-"+parts.day,time:parts.hour+":"+parts.minute};
}
/** Human-readable UK time with zone label, e.g. "Mon 30 Nov 2026, 07:30 GMT". */
export function formatUk(iso){
 return new Intl.DateTimeFormat("en-GB",{timeZone:UK_TIME_ZONE,weekday:"short",day:"numeric",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit",hourCycle:"h23",timeZoneName:"short"}).format(new Date(iso));
}
/** Next UK calendar date (YYYY-MM-DD) for the default form value. */
export function tomorrowUk(nowMs=Date.now()){
 return utcIsoToUkParts(new Date(nowMs+86400000).toISOString()).date;
}
/** Validate a schedule time: must be at least MIN_LEAD_MINUTES ahead and within MAX_DAYS_AHEAD. */
export function scheduleWindowError(iso,nowMs=Date.now()){
 const ms=Date.parse(iso||"");
 if(!Number.isFinite(ms))return "invalid_time";
 if(ms<nowMs+MIN_LEAD_MINUTES*60000)return "time_must_be_in_future";
 if(ms>nowMs+MAX_DAYS_AHEAD*86400000)return "time_too_far_ahead";
 return null;
}
