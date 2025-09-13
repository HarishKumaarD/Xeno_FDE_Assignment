"use client"

import type React from "react"

import { useState, useEffect, useCallback } from "react"
import { ComposedChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Bar } from "recharts"
import type { DateRange } from "react-day-picker"
import { addDays, format } from "date-fns"
import { useClerk } from "@clerk/nextjs"
import { TrendingUp, Users, ShoppingCart, DollarSign, Activity, Crown, RefreshCw, X } from "lucide-react"

// --- Interface Definitions ---
interface Totals {
  totalSpent: number
  totalOrders: number
  totalCustomers: number
}
interface CurrentMonth {
  revenue: number
  orders: number
  month: number
  year: number
}

interface ChartData {
  date: string
  Orders: number
}

interface TopCustomer {
  customerId?: string
  name: string
  email: string
  totalSpend: number
}

interface AvgRevenueData {
  date: string
  avgRevenue: number
  orderCount?: number
}

interface TopOrder {
  id: string
  orderNumber: string | null
  total: number
  currency: string
  date: string | null
  customerName: string
  customerEmail?: string
}

interface StoreSummary {
  id: string
  shop: string
}

// --- Main Dashboard Component ---
export default function DashboardPage() {
  // --- State Management ---
  const [totals, setTotals] = useState<Totals | null>(null)
  const [chartData, setChartData] = useState<ChartData[]>([])
  const [avgRevenueData, setAvgRevenueData] = useState<AvgRevenueData[]>([])
  const [topCustomers, setTopCustomers] = useState<TopCustomer[]>([])
  const [topOrders, setTopOrders] = useState<TopOrder[]>([])
  const [currentMonth, setCurrentMonth] = useState<CurrentMonth | null>(null)
  const [date] = useState<DateRange | undefined>({
    from: addDays(new Date(), -30), // Default to last 30 days
    to: new Date(),
  })
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isSyncing, setIsSyncing] = useState(false)
  const [lastSynced, setLastSynced] = useState<Date | null>(null)
  const [selectedCustomer, setSelectedCustomer] = useState<{ id: string; name: string } | null>(null)
  const [customerOrders, setCustomerOrders] = useState<
    { id: string; orderNumber: string | null; date: string | null; total: number; currency: string }[]
  >([])
  const [isOrdersLoading, setIsOrdersLoading] = useState(false)

  const [stores, setStores] = useState<StoreSummary[]>([])
  const [storeId, setStoreId] = useState<string | null>(null)

  const { signOut } = useClerk()

  const ensureStoreSelected = useCallback(async () => {
    if (storeId) return storeId
    
    try {
      const res = await fetch("/api/stores", { cache: "no-store" })
      if (!res.ok) throw new Error("Failed to load stores")
      
      const data = (await res.json()) as { stores: StoreSummary[] }
      setStores(data.stores || [])
      
      const first = data.stores?.[0]?.id || null
      setStoreId(first)
      
      if (!first) throw new Error("No stores found in the database")
      return first
    } catch (error) {
      console.error("Error loading stores:", error)
      throw error
    }
  }, [storeId])

  const withStoreParam = (url: string, id: string) => {
    const sep = url.includes("?") ? "&" : "?"
    return `${url}${sep}storeId=${encodeURIComponent(id)}`
  }

  // --- Data Fetching Logic ---
  const fetchData = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    
    try {
      const id = await ensureStoreSelected()
      
      // Fetch all dashboard data in parallel for better performance
      const [totalsRes, chartRes, avgRevRes, topCustomersRes, currentMonthRes] = await Promise.all([
        fetch(withStoreParam("/api/insights/totals", id)),
        fetch(
          withStoreParam(
            `/api/insights/orders-by-date?startDate=${format(date!.from!, "yyyy-MM-dd")}&endDate=${format(date!.to!, "yyyy-MM-dd")}`,
            id,
          ),
        ),
        fetch(
          withStoreParam(
            `/api/insights/avg-revenue-by-date?startDate=${format(date!.from!, "yyyy-MM-dd")}&endDate=${format(date!.to!, "yyyy-MM-dd")}`,
            id,
          ),
        ),
        fetch(withStoreParam("/api/insights/top-customers", id)),
        fetch(withStoreParam("/api/insights/current-month", id)),
      ])

      if (!totalsRes.ok || !chartRes.ok || !avgRevRes.ok || !topCustomersRes.ok || !currentMonthRes.ok) {
        throw new Error("One or more data requests failed. Please refresh.")
      }

      const totalsData = await totalsRes.json()
      const chartData = await chartRes.json()
      const avgRevenueData = await avgRevRes.json()
      const topCustomersAndOrdersData = await topCustomersRes.json()
      const currentMonthData = await currentMonthRes.json()

      setTotals(totalsData)
      setChartData(chartData)
      setAvgRevenueData(avgRevenueData)
      
      // Handle the combined response
      if (topCustomersAndOrdersData.topCustomers && topCustomersAndOrdersData.topOrders) {
        // New combined format
        setTopCustomers(topCustomersAndOrdersData.topCustomers)
        setTopOrders(topCustomersAndOrdersData.topOrders)
      } else if (Array.isArray(topCustomersAndOrdersData)) {
        // Fallback for old format (just customers)
        setTopCustomers(topCustomersAndOrdersData)
        setTopOrders([])
      } else {
        // Handle error case
        setTopCustomers([])
        setTopOrders([])
      }
      
      setCurrentMonth(currentMonthData)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      console.error("Error fetching dashboard data:", err)
      setError(message)
    } finally {
      setIsLoading(false)
    }
  }, [date, ensureStoreSelected])

  // Poll totals endpoint until data is available or timeout
  const pollUntilReady = useCallback(async () => {
    const timeoutMs = 30000
    const start = Date.now()
    let delay = 1000
    
    try {
      const id = await ensureStoreSelected()
      
      while (Date.now() - start < timeoutMs) {
        try {
          const res = await fetch(withStoreParam("/api/insights/totals", id), { cache: "no-store" })
          if (res.ok) {
            const data: Totals = await res.json()
            const hasData = (data.totalOrders ?? 0) > 0 || (data.totalCustomers ?? 0) > 0 || (data.totalSpent ?? 0) > 0
            if (hasData) {
              setTotals(data)
              return true
            }
          }
        } catch (pollError) {
          console.error("Polling error:", pollError)
        }
        
        await new Promise((r) => setTimeout(r, delay))
        delay = Math.min(Math.floor(delay * 1.5), 5000)
      }
      return false
    } catch (error) {
      console.error("Poll until ready error:", error)
      return false
    }
  }, [ensureStoreSelected])

  // --- Sync Data Function ---
  const syncData = useCallback(async () => {
    setIsSyncing(true)
    setError(null)
    
    try {
      const id = await ensureStoreSelected()
      
      // Start sync in background (no wait)
      const response = await fetch(withStoreParam("/api/sync", id), {
        method: "POST",
      })

      if (!response.ok && response.status !== 202) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || "Failed to start sync")
      }

      // Poll until totals shows data or timeout, then fetch full dashboard
      await pollUntilReady()
      setLastSynced(new Date())
      await fetchData()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      console.error("Error syncing data:", err)
      setError(message)
    } finally {
      setIsSyncing(false)
    }
  }, [fetchData, pollUntilReady, ensureStoreSelected])

  const loadCustomerOrders = useCallback(
    async (customerId: string) => {
      setIsOrdersLoading(true)
      try {
        const id = await ensureStoreSelected()
        const res = await fetch(
          withStoreParam(
            `/api/insights/customer-orders?customerId=${customerId}&startDate=${format(date!.from!, "yyyy-MM-dd")}&endDate=${format(date!.to!, "yyyy-MM-dd")}`,
            id
          )
        )
        if (!res.ok) throw new Error("Failed to load customer orders")
        const data = await res.json()
        setCustomerOrders(data)
      } catch (e) {
        console.error(e)
        setCustomerOrders([])
      } finally {
        setIsOrdersLoading(false)
      }
    },
    [date, ensureStoreSelected],
  )

  // Initial data fetch and sync
  useEffect(() => {
    const initializeDashboard = async () => {
      try {
        // Start background sync and poll; then fetch dashboard data
        await syncData()
      } catch (error) {
        console.error("Failed to initialize dashboard:", error)
        setError("Failed to initialize dashboard. Please refresh the page.")
        setIsLoading(false)
        setIsSyncing(false)
      }
    }

    initializeDashboard()
  }, [syncData])

  // --- Render Method ---
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-teal-50 to-cyan-50">
      <nav className="bg-white/80 backdrop-blur-md border-b border-teal-100 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-gradient-to-r from-teal-500 to-cyan-500 rounded-lg flex items-center justify-center">
                <Activity className="w-5 h-5 text-white" />
              </div>
              <h1 className="text-xl font-bold bg-gradient-to-r from-teal-600 to-cyan-600 bg-clip-text text-transparent">
                Xeno
              </h1>
            </div>
            <div className="flex items-center space-x-4">
              {stores.length > 0 && (
                <div className="text-sm text-slate-700 bg-white px-3 py-2 rounded-md border border-slate-200">
                  Store: {stores[0].shop}
                </div>
              )}
              {lastSynced && (
                <div className="text-sm text-slate-500">Last synced: {lastSynced.toLocaleTimeString()}</div>
              )}
              <button
                onClick={syncData}
                disabled={isSyncing}
                className="flex items-center space-x-2 px-4 py-2 text-sm font-medium text-teal-600 hover:text-teal-700 hover:bg-teal-50 rounded-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <RefreshCw className={`w-4 h-4 ${isSyncing ? "animate-spin" : ""}`} />
                <span>{isSyncing ? "Syncing..." : "Refresh Data"}</span>
              </button>
              <button
                onClick={() =>
                  signOut(() => {
                    window.location.href = "/login"
                  })
                }
                className="px-4 py-2 text-sm font-medium text-teal-600 hover:text-teal-700 hover:bg-teal-50 rounded-lg transition-colors duration-200"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto p-6 space-y-8">
        <header className="text-center space-y-2">
          <h2 className="text-4xl font-bold text-slate-900">Store Analytics</h2>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto">
            Comprehensive insights into your revenue performance, order trends, and customer behavior
          </p>
        </header>

        {error && (
          <div
            className="bg-red-50 border-l-4 border-red-400 text-red-700 px-6 py-4 rounded-r-lg shadow-sm"
            role="alert"
          >
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <div className="ml-3">
                <p className="font-medium">Error: {error}</p>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <MetricCard
            title="Total Revenue"
            value={totals ? `₹${totals.totalSpent.toLocaleString("en-IN")}` : ""}
            isLoading={isLoading}
            icon={DollarSign}
            trend="+12.5%"
            trendUp={true}
          />
          <MetricCard
            title="Total Orders"
            value={totals?.totalOrders.toString()}
            isLoading={isLoading}
            icon={ShoppingCart}
            trend="+8.2%"
            trendUp={true}
          />
          <MetricCard
            title="Total Customers"
            value={totals?.totalCustomers.toString()}
            isLoading={isLoading}
            icon={Users}
            trend="+15.3%"
            trendUp={true}
          />
          {currentMonth && (
            <MetricCard
              title={`Current Month Revenue`}
              value={`₹${currentMonth.revenue.toLocaleString("en-IN")}`}
              isLoading={isLoading}
              icon={DollarSign}
              trend={`${currentMonth.orders.toLocaleString("en-IN")} orders`}
              trendUp={true}
            />
          )}
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
          <div className="xl:col-span-2 space-y-8">
            <ChartCard chartData={chartData} isLoading={isLoading} />
            <AvgRevenueCard avgRevenueData={avgRevenueData} isLoading={isLoading} />
          </div>
          <div className="xl:col-span-1 space-y-8">
            <TopCustomersCard
              topCustomers={topCustomers}
              isLoading={isLoading}
              onSelectCustomer={(c) => {
                if (!c.customerId) return
                setSelectedCustomer({ id: c.customerId, name: c.name })
                loadCustomerOrders(c.customerId)
              }}
            />
            <TopOrdersCard topOrders={topOrders} isLoading={isLoading} />
          </div>
        </div>

        {selectedCustomer && (
          <CustomerOrdersModal
            customerName={selectedCustomer.name}
            orders={customerOrders}
            isLoading={isOrdersLoading}
            onClose={() => {
              setSelectedCustomer(null)
              setCustomerOrders([])
            }}
          />
        )}
      </div>
    </div>
  )
}

const MetricCard = ({
  title,
  value,
  isLoading,
  icon: Icon,
  trend,
  trendUp,
}: {
  title: string
  value?: string
  isLoading: boolean
  icon: React.ComponentType<{ className?: string }>
  trend?: string
  trendUp?: boolean
}) => (
  <div className="group relative overflow-hidden rounded-2xl bg-white p-6 shadow-sm border border-teal-100 hover:shadow-lg hover:border-teal-200 transition-all duration-300">
    <div className="absolute inset-0 bg-gradient-to-br from-teal-50/50 to-cyan-50/30 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

    <div className="relative flex items-start justify-between">
      <div className="space-y-3 flex-1">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-gradient-to-r from-teal-500 to-cyan-500 rounded-lg">
            <Icon className="w-5 h-5 text-white" />
          </div>
          <h3 className="text-sm font-semibold text-slate-600 uppercase tracking-wide">{title}</h3>
        </div>

        {isLoading ? (
          <div className="space-y-2">
            <div className="h-8 w-3/4 bg-slate-200 rounded-lg animate-pulse"></div>
            <div className="h-4 w-1/2 bg-slate-100 rounded animate-pulse"></div>
          </div>
        ) : (
          <div className="space-y-1">
            <p className="text-3xl font-bold text-slate-900">{value}</p>
            {trend && (
              <div className={`flex items-center space-x-1 text-sm ${trendUp ? "text-emerald-600" : "text-red-500"}`}>
                <TrendingUp className={`w-4 h-4 ${!trendUp && "rotate-180"}`} />
                <span className="font-medium">{trend}</span>
                <span className="text-slate-500">vs last month</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  </div>
)

const ChartCard = ({ chartData, isLoading }: { chartData: ChartData[]; isLoading: boolean }) => (
  <div className="relative overflow-hidden rounded-2xl bg-white p-8 shadow-sm border border-teal-100">
    <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-teal-500 to-cyan-500" />

    <div className="flex items-center justify-between mb-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Sales Performance</h2>
        <p className="text-slate-600 mt-1">Order trends over time</p>
      </div>
      <div className="p-3 bg-gradient-to-r from-teal-50 to-cyan-50 rounded-xl">
        <TrendingUp className="w-6 h-6 text-teal-600" />
      </div>
    </div>

    <div className="w-full h-80">
      {isLoading ? (
        <div className="flex items-center justify-center h-full">
          <div className="space-y-4 w-full">
            <div className="h-4 bg-slate-200 rounded animate-pulse"></div>
            <div className="h-4 bg-slate-100 rounded animate-pulse w-3/4"></div>
            <div className="h-4 bg-slate-200 rounded animate-pulse w-1/2"></div>
          </div>
        </div>
      ) : chartData.length > 0 ? (
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 20 }}>
            <defs>
              <linearGradient id="modernOrdersGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#14b8a6" stopOpacity={0.8} />
                <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.1} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" strokeOpacity={0.5} />
            <XAxis dataKey="date" fontSize={12} tickMargin={10} stroke="#000000" tick={{ fill: "#000000" }} />
            <YAxis allowDecimals={false} fontSize={12} tickMargin={10} stroke="#000000" tick={{ fill: "#000000" }} />
            <Tooltip
              contentStyle={{
                backgroundColor: "white",
                border: "1px solid #e2e8f0",
                borderRadius: "12px",
                boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1)",
              }}
              labelStyle={{ color: "#000000" }}
            />
            <Area
              name="Orders"
              type="monotone"
              dataKey="Orders"
              stroke="#14b8a6"
              strokeWidth={3}
              fill="url(#modernOrdersGradient)"
              fillOpacity={1}
            />
          </ComposedChart>
        </ResponsiveContainer>
      ) : (
        <div className="flex flex-col items-center justify-center h-full text-slate-500">
          <ShoppingCart className="w-12 h-12 mb-4 text-slate-300" />
          <p className="text-lg font-medium">No orders in this period</p>
          <p className="text-sm">Data will appear here once orders are placed</p>
        </div>
      )}
    </div>
  </div>
)

const AvgRevenueCard = ({ avgRevenueData, isLoading }: { avgRevenueData: AvgRevenueData[]; isLoading: boolean }) => (
  <div className="relative overflow-hidden rounded-2xl bg-white p-8 shadow-sm border border-teal-100">
    <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-teal-500 to-cyan-500" />

    <div className="flex items-center justify-between mb-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Average Revenue by Day</h2>
        <p className="text-slate-600 mt-1">Average value and number of orders per day</p>
      </div>
      <div className="p-3 bg-gradient-to-r from-teal-50 to-cyan-50 rounded-xl">
        <TrendingUp className="w-6 h-6 text-teal-600" />
      </div>
    </div>

    <div className="w-full h-80">
      {isLoading ? (
        <div className="flex items-center justify-center h-full">
          <div className="space-y-4 w-full">
            <div className="h-4 bg-slate-200 rounded animate-pulse"></div>
            <div className="h-4 bg-slate-100 rounded animate-pulse w-3/4"></div>
            <div className="h-4 bg-slate-200 rounded animate-pulse w-1/2"></div>
          </div>
        </div>
      ) : avgRevenueData.length > 0 ? (
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={avgRevenueData} margin={{ top: 20, right: 30, left: 0, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" strokeOpacity={0.5} />
            <XAxis dataKey="date" fontSize={12} tickMargin={10} stroke="#000000" tick={{ fill: "#000000" }} />
            <YAxis
              yAxisId="left"
              allowDecimals={true}
              fontSize={12}
              tickMargin={10}
              stroke="#000000"
              tick={{ fill: "#000000" }}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              allowDecimals={false}
              fontSize={12}
              tickMargin={10}
              stroke="#000000"
              tick={{ fill: "#000000" }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "white",
                border: "1px solid #e2e8f0",
                borderRadius: "12px",
                boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1)",
              }}
              labelStyle={{ color: "#000000" }}
              formatter={(value, name) => {
                if (name === "Avg Revenue") return [`₹${Number(value).toLocaleString("en-IN")}`, name]
                if (name === "Orders") return [Number(value).toLocaleString("en-IN"), name]
                return [String(value), name]
              }}
            />
            <Bar yAxisId="left" dataKey="avgRevenue" name="Avg Revenue" fill="#0ea5e9" radius={[6, 6, 0, 0]} />
            <Bar yAxisId="right" dataKey="orderCount" name="Orders" fill="#14b8a6" radius={[6, 6, 0, 0]} />
          </ComposedChart>
        </ResponsiveContainer>
      ) : (
        <div className="flex flex-col items-center justify-center h-full text-slate-500">
          <ShoppingCart className="w-12 h-12 mb-4 text-slate-300" />
          <p className="text-lg font-medium">No data in this period</p>
          <p className="text-sm">Data will appear here once orders are placed</p>
        </div>
      )}
    </div>
  </div>
)

const TopCustomersCard = ({
  topCustomers,
  isLoading,
  onSelectCustomer,
}: { topCustomers: TopCustomer[]; isLoading: boolean; onSelectCustomer?: (c: TopCustomer) => void }) => (
  <div className="relative overflow-hidden rounded-2xl bg-white p-6 shadow-sm border border-teal-100">
    <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-teal-500 to-cyan-500" />

    <div className="flex items-center justify-between mb-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900">Top Customers</h2>
        <p className="text-slate-600 text-sm mt-1">Ranked by total spend</p>
      </div>
      <div className="p-2 bg-gradient-to-r from-teal-50 to-cyan-50 rounded-lg">
        <Crown className="w-5 h-5 text-teal-600" />
      </div>
    </div>

    {isLoading ? (
      <div className="space-y-4">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex items-center space-x-4">
            <div className="w-10 h-10 bg-slate-200 rounded-full animate-pulse"></div>
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-slate-200 rounded animate-pulse"></div>
              <div className="h-3 bg-slate-100 rounded animate-pulse w-3/4"></div>
            </div>
            <div className="h-4 w-16 bg-slate-200 rounded animate-pulse"></div>
          </div>
        ))}
      </div>
    ) : topCustomers.length > 0 ? (
      <div className="space-y-4">
        {topCustomers.map((customer, index) => (
          <div
            key={(customer.email || index) + (customer.customerId || "")}
            className="group flex items-center space-x-4 p-3 rounded-xl hover:bg-gradient-to-r hover:from-teal-50 hover:to-cyan-50 transition-all duration-200 cursor-pointer"
            onClick={() => onSelectCustomer && onSelectCustomer(customer)}
          >
            <div
              className={`flex h-10 w-10 items-center justify-center rounded-full font-bold text-white ${
                index === 0
                  ? "bg-gradient-to-r from-yellow-400 to-orange-500"
                  : index === 1
                    ? "bg-gradient-to-r from-gray-400 to-gray-500"
                    : index === 2
                      ? "bg-gradient-to-r from-amber-600 to-orange-600"
                      : "bg-gradient-to-r from-teal-500 to-cyan-500"
              }`}
            >
              {index + 1}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-900 truncate group-hover:text-teal-900 transition-colors">
                {customer.name}
              </p>
              <p className="text-xs text-slate-500 truncate">{customer.email}</p>
            </div>
            <div className="text-right">
              <p className="text-sm font-bold text-slate-900">₹{customer.totalSpend.toLocaleString("en-IN")}</p>
              <p className="text-xs text-slate-500">total spend</p>
            </div>
          </div>
        ))}
      </div>
    ) : (
      <div className="flex flex-col items-center justify-center py-12 text-slate-500">
        <Users className="w-12 h-12 mb-4 text-slate-300" />
        <p className="text-lg font-medium">No customer data</p>
        <p className="text-sm text-center">Customer spending data will appear here</p>
      </div>
    )}
  </div>
)

const TopOrdersCard = ({
  topOrders,
  isLoading,
}: {
  topOrders: TopOrder[]
  isLoading: boolean
}) => (
  <div className="relative overflow-hidden rounded-2xl bg-white p-6 shadow-sm border border-teal-100">
    <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-teal-500 to-cyan-500" />

    <div className="flex items-center justify-between mb-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900">Top 5 Orders by Value</h2>
        <p className="text-slate-600 text-sm mt-1">Highest value orders in the selected range</p>
      </div>
      <div className="p-2 bg-gradient-to-r from-teal-50 to-cyan-50 rounded-lg">
        <DollarSign className="w-5 h-5 text-teal-600" />
      </div>
    </div>

    {isLoading ? (
      <div className="space-y-4">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-slate-50 animate-pulse">
            <div className="h-4 w-24 bg-slate-200 rounded" />
            <div className="h-4 w-32 bg-slate-200 rounded" />
            <div className="h-4 w-20 bg-slate-200 rounded" />
          </div>
        ))}
      </div>
    ) : topOrders.length > 0 ? (
      <ul className="space-y-3">
        {topOrders.map((o, idx) => (
          <li
            key={o.id}
            className="group flex items-center justify-between p-3 rounded-xl hover:bg-gradient-to-r hover:from-teal-50 hover:to-cyan-50 transition-all duration-200"
          >
            <div className="flex items-center space-x-3">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-md text-xs font-bold text-white ${
                  idx === 0
                    ? "bg-gradient-to-r from-yellow-400 to-orange-500"
                    : idx === 1
                      ? "bg-gradient-to-r from-gray-400 to-gray-500"
                      : idx === 2
                        ? "bg-gradient-to-r from-amber-600 to-orange-600"
                        : "bg-gradient-to-r from-teal-500 to-cyan-500"
                }`}
              >
                #{idx + 1}
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900">{o.orderNumber || o.id}</p>
                <p className="text-xs text-slate-500">
                  {o.customerName} {o.customerEmail ? `• ${o.customerEmail}` : ""}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm font-bold text-slate-900">
                ₹{o.total.toLocaleString("en-IN")}
              </p>
              <p className="text-xs text-slate-500">{o.date ? new Date(o.date).toLocaleDateString() : "No date"}</p>
            </div>
          </li>
        ))}
      </ul>
    ) : (
      <div className="flex flex-col items-center justify-center py-12 text-slate-500">
        <ShoppingCart className="w-12 h-12 mb-4 text-slate-300" />
        <p className="text-lg font-medium">No orders found</p>
        <p className="text-sm text-center">New orders will appear here</p>
      </div>
    )}
  </div>
)

function CustomerOrdersModal({
  customerName,
  orders,
  isLoading,
  onClose,
}: {
  customerName: string
  orders: { id: string; orderNumber: string | null; date: string | null; total: number; currency: string }[]
  isLoading: boolean
  onClose: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative w-full max-w-2xl mx-4 bg-white rounded-2xl shadow-xl border border-teal-100 overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Orders for {customerName}</h3>
            <p className="text-xs text-slate-500">Showing orders in selected date range</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100">
            <X className="w-5 h-5 text-slate-600" />
          </button>
        </div>
        <div className="max-h-[60vh] overflow-y-auto">
          {isLoading ? (
            <div className="p-6 space-y-3">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-12 bg-slate-100 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : orders.length === 0 ? (
            <div className="p-6 text-center text-slate-600">No orders for this customer in the selected period.</div>
          ) : (
            <ul className="divide-y">
              {orders.map((o) => (
                <li key={o.id} className="flex items-center justify-between p-4">
                  <div>
                    <p className="text-sm font-medium text-slate-900">{o.orderNumber || o.id}</p>
                    <p className="text-xs text-slate-500">{o.date ? new Date(o.date).toLocaleString() : "No date"}</p>
                  </div>
                  <div className="text-sm font-semibold text-slate-900">₹{o.total.toLocaleString("en-IN")}</div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}