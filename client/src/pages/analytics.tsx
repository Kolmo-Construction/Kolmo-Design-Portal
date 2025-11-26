import { useState } from "react";
import TopNavBar from "@/components/TopNavBar";
import Sidebar from "@/components/Sidebar";
import QuoteAnalyticsOverview from "@/components/dashboard/QuoteAnalyticsOverview";

export default function AnalyticsPage() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="h-screen bg-gray-50">
      <TopNavBar open={sidebarOpen} setOpen={setSidebarOpen} />
      <Sidebar open={sidebarOpen} setOpen={setSidebarOpen} />
      
      <main className="lg:ml-64 p-6 pt-24 overflow-auto h-full">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Quote Analytics</h1>
          <p className="text-gray-600">
            Track customer engagement with your quotes
          </p>
        </div>

        <QuoteAnalyticsOverview />
      </main>
    </div>
  );
}
