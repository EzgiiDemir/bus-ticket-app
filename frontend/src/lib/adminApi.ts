// src/app/lib/adminApi.ts
import axios from 'axios';

const asArr = (x: any, key?: string) =>
    Array.isArray(x) ? x
        : (key && Array.isArray(x?.[key])) ? x[key]
            : Array.isArray(x?.data) ? x.data
                : [];

export const getAdminOverview = () =>
    axios.get('/admin/dashboard/overview')
        .then(r => r.data?.totals ?? r.data ?? {
            orders: 0, revenue: 0, active_trips: 0, upcoming: 0, personnel: 0, customers: 0, companies: 0, pending_staff: 0
        });

export const getRevenueSeries = (range = 30) =>
    axios.get('/admin/dashboard/revenue-timeseries', { params: { range } })
        .then(r => asArr(r.data, 'series'));

export const getCompanyBreakdown = () =>
    axios.get('/admin/dashboard/company-breakdown')
        .then(r => asArr(r.data, 'companies'));

export const getTopRoutes = () =>
    axios.get('/admin/dashboard/top-routes')
        .then(r => asArr(r.data, 'routes'));

export const listPersonnel = (params?: any) =>
    axios.get('/admin/personnel', { params })
        .then(r => asArr(r.data, 'personnel'));

export const listCustomers = (params?: any) =>
    axios.get('/admin/customers', { params })
        .then(r => asArr(r.data, 'customers'));

export const listCompanies = () =>
    axios.get('/admin/companies')
        .then(r => asArr(r.data, 'companies'));

export const listTrips = (params?: any) =>
    axios.get('/admin/trips', { params })
        .then(r => asArr(r.data, 'trips'));

export const listApprovals = () =>
    axios.get('/admin/approvals')
        .then(r => asArr(r.data, 'users'));

export const approveUser = (id: number) =>
    axios.post(`/admin/approvals/${id}/approve`);

export const rejectUser = (id: number) =>
    axios.post(`/admin/approvals/${id}/reject`);
