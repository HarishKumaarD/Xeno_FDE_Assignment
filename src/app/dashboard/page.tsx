"use client"

import { useState, useEffect, useCallback } from "react"
import { ComposedChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"
import type { DateRange } from "react-day-picker"
import { addDays, format } from "date-fns"
import { signOut } from "next-auth/react"
import { TrendingUp, Users, ShoppingCart, DollarSign, Activity, Crown } from "lucide-react"

// --- Interface Definitions ---
interface Totals {
  totalSpent: number
  totalOrders: number
  totalCustomers: number
}

interface ChartData {
  date: string
  Orders: number
}

interface TopCustomer {
  name: string
  email: string
  totalSpend: number
}

// --- Main Dashboard Component ---
export default function DashboardPage() {
  // --- State Management ---
  const [totals, setTotals] = useState<Totals | null>(null)
  const [chartData, setChartData] = useState<ChartData[]>([])
  const [topCustomers, setTopCustomers] = useState<TopCustomer[]>([])
  const [date] = useState<DateRange | undefined>({
    from: addDays(new Date(), -30), // Default to last 30 days
    to: new Date(),
  })
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // --- Data Fetching Logic ---
  const fetchData = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      // Fetch all dashboard data in parallel for better performance
      const [totalsRes, chartRes, topCustomersRes] = await Promise.all([
        fetch("/api/insights/totals"),
        fetch(
          `/api/insights/orders-by-date?startDate=${format(date!.from!, "yyyy-MM-dd")}&endDate=${format(date!.to!, "yyyy-MM-dd")}`,
        ),
        fetch("/api/insights/top-customers"),
      ])

      if (!totalsRes.ok || !chartRes.ok || !topCustomersRes.ok) {
        throw new Error("One or more data requests failed. Please refresh.")
      }

      const totalsData = await totalsRes.json()
      const chartData = await chartRes.json()
      const topCustomersData = await topCustomersRes.json()

      setTotals(totalsData)
      setChartData(chartData)
      setTopCustomers(topCustomersData)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      console.error("Error fetching dashboard data:", err)
      setError(message)
    } finally {
      setIsLoading(false)
    }
  }, [date])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // --- Render Method ---
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <nav className="bg-white/80 backdrop-blur-md border-b border-blue-100 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-lg flex items-center justify-center">
                <Activity className="w-5 h-5 text-white" />
              </div>
              <h1 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                Analytics Hub
              </h1>
            </div>
            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="px-4 py-2 text-sm font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors duration-200"
            >
              Sign Out
            </button>
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

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
          <div className="xl:col-span-2">
            <ChartCard chartData={chartData} isLoading={isLoading} />
          </div>
          <div className="xl:col-span-1">
            <TopCustomersCard topCustomers={topCustomers} isLoading={isLoading} />
          </div>
        </div>
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
  icon: any
  trend?: string
  trendUp?: boolean
}) => (
  <div className="group relative overflow-hidden rounded-2xl bg-white p-6 shadow-sm border border-blue-100 hover:shadow-lg hover:border-blue-200 transition-all duration-300">
    <div className="absolute inset-0 bg-gradient-to-br from-blue-50/50 to-indigo-50/30 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

    <div className="relative flex items-start justify-between">
      <div className="space-y-3 flex-1">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-lg">
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
  <div className="relative overflow-hidden rounded-2xl bg-white p-8 shadow-sm border border-blue-100">
    <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 to-indigo-500" />

    <div className="flex items-center justify-between mb-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Sales Performance</h2>
        <p className="text-slate-600 mt-1">Order trends over time</p>
      </div>
      <div className="p-3 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl">
        <TrendingUp className="w-6 h-6 text-blue-600" />
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
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8} />
                <stop offset="95%" stopColor="#6366f1" stopOpacity={0.1} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" strokeOpacity={0.5} />
            <XAxis dataKey="date" fontSize={12} tickMargin={10} stroke="#64748b" tick={{ fill: "#64748b" }} />
            <YAxis allowDecimals={false} fontSize={12} tickMargin={10} stroke="#64748b" tick={{ fill: "#64748b" }} />
            <Tooltip
              contentStyle={{
                backgroundColor: "white",
                border: "1px solid #e2e8f0",
                borderRadius: "12px",
                boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1)",
              }}
            />
            <Area
              name="Orders"
              type="monotone"
              dataKey="Orders"
              stroke="#3b82f6"
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

const TopCustomersCard = ({ topCustomers, isLoading }: { topCustomers: TopCustomer[]; isLoading: boolean }) => (
  <div className="relative overflow-hidden rounded-2xl bg-white p-6 shadow-sm border border-blue-100">
    <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 to-purple-500" />

    <div className="flex items-center justify-between mb-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900">Top Customers</h2>
        <p className="text-slate-600 text-sm mt-1">Ranked by total spend</p>
      </div>
      <div className="p-2 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-lg">
        <Crown className="w-5 h-5 text-indigo-600" />
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
            key={customer.email || index}
            className="group flex items-center space-x-4 p-3 rounded-xl hover:bg-gradient-to-r hover:from-blue-50 hover:to-indigo-50 transition-all duration-200"
          >
            <div
              className={`flex h-10 w-10 items-center justify-center rounded-full font-bold text-white ${
                index === 0
                  ? "bg-gradient-to-r from-yellow-400 to-orange-500"
                  : index === 1
                    ? "bg-gradient-to-r from-gray-400 to-gray-500"
                    : index === 2
                      ? "bg-gradient-to-r from-amber-600 to-orange-600"
                      : "bg-gradient-to-r from-blue-500 to-indigo-500"
              }`}
            >
              {index + 1}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-900 truncate group-hover:text-blue-900 transition-colors">
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
