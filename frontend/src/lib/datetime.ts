export const fmtTR = (iso?: string) =>
    iso ? new Date(iso).toLocaleString('tr-TR', {
        year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit'
    }) : '';
