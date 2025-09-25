import { api } from './api';

export async function listApprovalsAdmin(token?:string){
    const res = await api.get('/admin/approvals', { token, params:{ per_page:100 } });
    return api.json(res);
}
export async function adminApprove(id:number, token?:string){
    const res = await api.post(`/admin/approvals/${id}/approve`, {}, { token });
    return api.json(res);
}
export async function adminReject(id:number, token?:string){
    const res = await api.post(`/admin/approvals/${id}/reject`, {}, { token });
    return api.json(res);
}

// Company IK
export async function listApprovalsCompany(token?:string){
    const res = await api.get('/company/approvals', { token, params:{ per_page:100 } });
    return api.json(res);
}
export async function companyApprove(id:number, token?:string){
    const res = await api.post(`/company/approvals/${id}/approve`, {}, { token });
    return api.json(res);
}
export async function companyReject(id:number, token?:string){
    const res = await api.post(`/company/approvals/${id}/reject`, {}, { token });
    return api.json(res);
}
