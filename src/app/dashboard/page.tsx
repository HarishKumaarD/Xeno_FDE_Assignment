"use client";

import { useState, useEffect, useCallback, type FC } from "react";
import {
  ComposedChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Bar,
} from "recharts";
import type { DateRange } from "react-day-picker";
import { addDays, format, parseISO } from "date-fns";
import { useClerk } from "@clerk/nextjs";
import {
  TrendingUp,
  Users,
  ShoppingCart,
  DollarSign,
  Activity,
  Crown,
  RefreshCw,
  X,
  Calendar as CalendarIcon,
} from "lucide-react";

// --- Interface Definitions ---
interface Totals {
  totalSpent: number;
  totalOrders: number;
  totalCustomers: number;
}
interface CurrentMonth {
  revenue: number;
  orders: number;
  month: number;
  year: number;
}
interface ChartData {
  date: string;
  Orders: number;
}
interface TopCustomer {
  customerId?: string;
  name: string;
  email: string;
  totalSpend: number;
}
interface AvgRevenueData {
  date: string;
  avgRevenue: number;
  orderCount?: number;
}
interface TopOrder {
  id: string;
  orderNumber: string | null;
  total: number;
  currency: string;
  date: string | null;
  customerName: string;
  customerEmail?: string;
}
interface StoreSummary {
  id: string;
  shop: string;
}

// --- Main Dashboard Component ---
export default function DashboardPage() {
  // --- State Management ---
  const [totals, setTotals] = useState<Totals | null>(null);
  const [chartData, setChartData] = useState<ChartData[]>([]);
  const [avgRevenueData, setAvgRevenueData] = useState<AvgRevenueData[]>([]);
  const [topCustomers, setTopCustomers] = useState<TopCustomer[]>([]);
  const [topOrders, setTopOrders] = useState<TopOrder[]>([]);
  const [currentMonth, setCurrentMonth] = useState<CurrentMonth | null>(null);
  const [startDate, setStartDate] = useState(format(addDays(new Date(), -30), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<{ id: string; name: string } | null>(null);
  const [customerOrders, setCustomerOrders] = useState<
    { id: string; orderNumber: string | null; date: string | null; total: number; currency: string }[]
  >([]);
  const [isOrdersLoading, setIsOrdersLoading] = useState(false);
  const [stores, setStores] = useState<StoreSummary[]>([]);
  const [storeId, setStoreId] = useState<string | null>(null);
  const { signOut } = useClerk();

  const ensureStoreSelected = useCallback(async () => {
    if (storeId) return storeId;
    try {
      const res = await fetch("/api/stores", { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load stores");
      const data = (await res.json()) as { stores: StoreSummary[] };
      const userStores = data.stores || [];
      setStores(userStores);
      const firstStoreId = userStores[0]?.id || null;
      if (!firstStoreId) {
        throw new Error("No stores found. Please connect your store via the /connect page.");
      }
      setStoreId(firstStoreId);
      return firstStoreId;
    } catch (error) {
      console.error("Error loading stores:", error);
      throw error;
    }
  }, [storeId]);

  const withStoreParam = (url: string, id: string) => {
    const sep = url.includes("?") ? "&" : "?";
    return `${url}${sep}storeId=${encodeURIComponent(id)}`;
  };

  const fetchData = useCallback(async () => {
    if (!startDate || !endDate) {
      setError("Please select a valid date range.");
      return;
    }
    
    setIsLoading(true);
    setError(null);

    try {
      const id = await ensureStoreSelected();
      const [totalsRes, chartRes, avgRevRes, topCustomersRes, currentMonthRes] = await Promise.all([
        fetch(withStoreParam("/api/insights/totals", id)),
        fetch(withStoreParam(`/api/insights/orders-by-date?startDate=${startDate}&endDate=${endDate}`, id)),
        fetch(withStoreParam(`/api/insights/avg-revenue-by-date?startDate=${startDate}&endDate=${endDate}`, id)),
        fetch(withStoreParam("/api/insights/top-customers", id)),
        fetch(withStoreParam("/api/insights/current-month", id)),
      ]);

      if (!totalsRes.ok || !chartRes.ok || !avgRevRes.ok || !topCustomersRes.ok || !currentMonthRes.ok) {
        throw new Error("One or more data requests failed. Please refresh.");
      }

      const totalsData = await totalsRes.json();
      const chartData = await chartRes.json();
      const avgRevenueData = await avgRevRes.json();
      const topCustomersAndOrdersData = await topCustomersRes.json();
      const currentMonthData = await currentMonthRes.json();

      setTotals(totalsData);
      setChartData(chartData);
      setAvgRevenueData(avgRevenueData);
      setTopCustomers(topCustomersAndOrdersData.topCustomers || []);
      setTopOrders(topCustomersAndOrdersData.topOrders || []);
      setCurrentMonth(currentMonthData);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [startDate, endDate, ensureStoreSelected]);

  const syncData = useCallback(async () => {
    setIsSyncing(true);
    setError(null);
    try {
      const id = await ensureStoreSelected();
      const response = await fetch(withStoreParam("/api/sync", id), { method: "POST" });
      if (!response.ok && response.status !== 202) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to start sync");
      }
      setTimeout(() => fetchData(), 5000); // Give sync time to process before refetch
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsSyncing(false);
    }
  }, [fetchData, ensureStoreSelected]);
  
  const loadCustomerOrders = useCallback(async (customerId: string) => {
      setIsOrdersLoading(true);
      try {
        const id = await ensureStoreSelected();
        const res = await fetch(withStoreParam(`/api/insights/customer-orders?customerId=${customerId}&startDate=${startDate}&endDate=${endDate}`,id));
        if (!res.ok) throw new Error("Failed to load customer orders");
        setCustomerOrders(await res.json());
      } catch (e) {
        console.error(e);
      } finally {
        setIsOrdersLoading(false);
      }
    },[startDate, endDate, ensureStoreSelected]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return (
    <div className="min-h-screen bg-slate-50">
      <nav className="bg-white/80 backdrop-blur-md border-b sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-3">
              <Activity className="w-8 h-8 text-teal-500" />
              <h1 className="text-xl font-bold text-slate-800">Xeno Insights</h1>
            </div>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2 text-sm">
                  <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="border rounded-md px-2 py-1"/>
                  <span>to</span>
                  <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="border rounded-md px-2 py-1"/>
              </div>
              <button onClick={syncData} disabled={isSyncing} className="flex items-center space-x-2 px-3 py-2 text-sm font-medium rounded-lg hover:bg-slate-100 disabled:opacity-50">
                <RefreshCw className={`w-4 h-4 ${isSyncing ? "animate-spin" : ""}`} />
                <span>{isSyncing ? "Syncing..." : "Refresh"}</span>
              </button>
              <button onClick={() => signOut(() => { window.location.href = "/login"; })} className="px-3 py-2 text-sm font-medium rounded-lg hover:bg-slate-100">
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </nav>
      <main className="max-w-7xl mx-auto p-6 space-y-6">
         {error && ( <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded-r-lg" role="alert"><p>{error}</p></div> )}
         
        {!isLoading && stores.length === 0 && !error && (
            <div className="text-center py-16">
                <h2 className="text-xl font-semibold">No Shopify Store Connected</h2>
                <button className="mt-4 px-4 py-2 bg-blue-500 text-white rounded-md" onClick={() => window.location.href='/connect'}>Connect Your Store</button>
            </div>
        )}

         <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
             <MetricCard title="Total Revenue" value={totals ? `₹${totals.totalSpent.toLocaleString("en-IN")}` : ""} isLoading={isLoading} icon={DollarSign}/>
             <MetricCard title="Total Orders" value={totals?.totalOrders.toString()} isLoading={isLoading} icon={ShoppingCart} />
             <MetricCard title="Total Customers" value={totals?.totalCustomers.toString()} isLoading={isLoading} icon={Users} />
             {currentMonth && ( <MetricCard title={`Current Month Revenue`} value={`₹${currentMonth.revenue.toLocaleString("en-IN")}`} isLoading={isLoading} icon={DollarSign} /> )}
         </div>

         <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <div className="xl:col-span-2 space-y-6">
                <ChartCard chartData={chartData} isLoading={isLoading} />
                <AvgRevenueCard avgRevenueData={avgRevenueData} isLoading={isLoading} />
            </div>
            <div className="xl:col-span-1 space-y-6">
                <TopCustomersCard topCustomers={topCustomers} isLoading={isLoading} onSelectCustomer={(c) => {
                    if (!c.customerId) return;
                    setSelectedCustomer({ id: c.customerId, name: c.name });
                    loadCustomerOrders(c.customerId);
                }}/>
                <TopOrdersCard topOrders={topOrders} isLoading={isLoading} />
            </div>
         </div>

        {selectedCustomer && ( <CustomerOrdersModal customerName={selectedCustomer.name} orders={customerOrders} isLoading={isOrdersLoading} onClose={() => setSelectedCustomer(null)} /> )}
      </main>
    </div>
  );
}

// --- Reusable UI Components ---
const MetricCard = ({ title, value, isLoading, icon: Icon }: { title: string; value?: string; isLoading: boolean; icon: React.ComponentType<{ className?: string }>;}) => (
    <div className="bg-white p-6 rounded-lg border">
        <div className="flex items-center space-x-3 mb-3">
            <Icon className="w-6 h-6 text-slate-500" />
            <h3 className="text-sm font-semibold text-slate-600 uppercase">{title}</h3>
        </div>
        {isLoading ? ( <div className="h-8 w-3/4 bg-slate-200 rounded animate-pulse"></div> ) : ( <p className="text-3xl font-bold text-slate-900">{value}</p> )}
    </div>
);

const ChartCard = ({ chartData, isLoading }: { chartData: ChartData[]; isLoading: boolean }) => (
    <div className="bg-white p-6 rounded-lg border">
        <h2 className="text-xl font-bold text-slate-900 mb-4">Sales Performance</h2>
        <div className="w-full h-80">
            {isLoading ? ( <div className="h-full w-full bg-slate-100 animate-pulse rounded-md"></div> ) : 
            chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="date" fontSize={12} />
                        <YAxis allowDecimals={false} fontSize={12} />
                        <Tooltip />
                        <Area type="monotone" dataKey="Orders" stroke="#14b8a6" fill="#14b8a6" fillOpacity={0.2} />
                    </ComposedChart>
                </ResponsiveContainer>
            ) : ( <div className="flex items-center justify-center h-full text-slate-500"><p>No orders in this period</p></div> )}
        </div>
    </div>
);

const AvgRevenueCard = ({ avgRevenueData, isLoading }: { avgRevenueData: AvgRevenueData[]; isLoading: boolean }) => (
    <div className="bg-white p-6 rounded-lg border">
        <h2 className="text-xl font-bold text-slate-900 mb-4">Average Revenue by Day</h2>
        <div className="w-full h-80">
            {isLoading ? ( <div className="h-full w-full bg-slate-100 animate-pulse rounded-md"></div> ) :
            avgRevenueData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={avgRevenueData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="date" fontSize={12} />
                        <YAxis yAxisId="left" fontSize={12} />
                        <YAxis yAxisId="right" orientation="right" fontSize={12} />
                        <Tooltip formatter={(value: number, name: string) => name === "Avg Revenue" ? `₹${value.toLocaleString("en-IN")}` : value} />
                        <Bar yAxisId="left" dataKey="avgRevenue" name="Avg Revenue" fill="#0ea5e9" />
                        <Bar yAxisId="right" dataKey="orderCount" name="Orders" fill="#14b8a6" />
                    </ComposedChart>
                </ResponsiveContainer>
            ) : ( <div className="flex items-center justify-center h-full text-slate-500"><p>No data in this period</p></div> )}
        </div>
    </div>
);

const TopCustomersCard = ({ topCustomers, isLoading, onSelectCustomer }: { topCustomers: TopCustomer[]; isLoading: boolean; onSelectCustomer?: (c: TopCustomer) => void }) => (
    <div className="bg-white p-6 rounded-lg border">
        <h2 className="text-xl font-bold text-slate-900 mb-4">Top Customers</h2>
        {isLoading ? ( <div className="space-y-4">{[...Array(5)].map((_, i) => <div key={i} className="h-10 bg-slate-100 rounded-md animate-pulse"></div>)}</div> ) : 
        topCustomers.length > 0 ? (
            <div className="space-y-2">
                {topCustomers.map((customer) => (
                    <div key={customer.customerId} className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 cursor-pointer" onClick={() => onSelectCustomer && onSelectCustomer(customer)}>
                        <div>
                            <p className="text-sm font-semibold">{customer.name}</p>
                            <p className="text-xs text-slate-500">{customer.email}</p>
                        </div>
                        <p className="text-sm font-bold">₹{customer.totalSpend.toLocaleString("en-IN")}</p>
                    </div>
                ))}
            </div>
        ) : ( <div className="text-center py-10 text-slate-500"><p>No customer data</p></div> )}
    </div>
);

const TopOrdersCard = ({ topOrders, isLoading }: { topOrders: TopOrder[]; isLoading: boolean; }) => (
    <div className="bg-white p-6 rounded-lg border">
        <h2 className="text-xl font-bold text-slate-900 mb-4">Top 5 Orders by Value</h2>
        {isLoading ? ( <div className="space-y-3">{[...Array(5)].map((_, i) => <div key={i} className="h-12 bg-slate-100 rounded-lg animate-pulse"></div>)}</div> ) : 
        topOrders.length > 0 ? (
            <ul className="space-y-2">
                {topOrders.map((o) => (
                    <li key={o.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-50">
                        <div>
                            <p className="text-sm font-semibold">{o.orderNumber || o.id}</p>
                            <p className="text-xs text-slate-500">{o.customerName}</p>
                        </div>
                        <div className="text-right">
                            <p className="text-sm font-bold">₹{o.total.toLocaleString("en-IN")}</p>
                            <p className="text-xs text-slate-500">{o.date ? new Date(o.date).toLocaleDateString() : ""}</p>
                        </div>
                    </li>
                ))}
            </ul>
        ) : ( <div className="text-center py-10 text-slate-500"><p>No orders found</p></div> )}
    </div>
);

function CustomerOrdersModal({ customerName, orders, isLoading, onClose }: { customerName: string; orders: { id: string; orderNumber: string | null; date: string | null; total: number; currency: string }[]; isLoading: boolean; onClose: () => void; }) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="w-full max-w-2xl bg-white rounded-lg shadow-xl m-4">
                <div className="flex items-center justify-between p-4 border-b">
                    <h3 className="text-lg font-semibold">Orders for {customerName}</h3>
                    <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100"><X className="w-5 h-5" /></button>
                </div>
                <div className="max-h-[60vh] overflow-y-auto">
                    {isLoading ? (<div className="p-6"><div className="h-24 bg-slate-100 rounded-lg animate-pulse"></div></div>) :
                    orders.length === 0 ? (<div className="p-6 text-center">No orders in the selected period.</div>) :
                    (<ul className="divide-y">
                        {orders.map((o) => (
                            <li key={o.id} className="flex justify-between p-4">
                                <div>
                                    <p className="font-medium">{o.orderNumber || o.id}</p>
                                    <p className="text-sm text-slate-500">{o.date ? new Date(o.date).toLocaleString() : ""}</p>
                                </div>
                                <div className="font-semibold">₹{o.total.toLocaleString("en-IN")}</div>
                            </li>
                        ))}
                    </ul>)
                    }
                </div>
            </div>
        </div>
    );
}

