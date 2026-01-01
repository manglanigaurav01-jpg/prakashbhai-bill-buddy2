import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, Users, Calculator, CreditCard, TrendingUp, Package, Settings as SettingsIcon, Edit3, Sun, Moon, BarChart, Search, RecycleIcon } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { GlobalSearch } from "@/components/GlobalSearch";
import { useTheme } from "@/lib/theme-manager";

interface DashboardProps {
  onNavigate: (view: string) => void;
}

interface MenuItem {
  id: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  hoverColor: string;
}

const menuItems: MenuItem[] = [
  {
    id: 'createBill',
    title: 'Create a Bill',
    description: 'Generate new invoices',
    icon: FileText,
    color: 'bg-blue-50 border-blue-200 text-blue-700',
    hoverColor: 'hover:bg-blue-100 hover:border-blue-300'
  },
  {
    id: 'amountTracker',
    title: 'Amount Tracker',
    description: 'Track payments & dues',
    icon: Calculator,
    color: 'bg-green-50 border-green-200 text-green-700',
    hoverColor: 'hover:bg-green-100 hover:border-green-300'
  },
  {
    id: 'lastBalance',
    title: 'Last Balance',
    description: 'View recent balances',
    icon: CreditCard,
    color: 'bg-yellow-50 border-yellow-200 text-yellow-700',
    hoverColor: 'hover:bg-yellow-100 hover:border-yellow-300'
  },
  {
    id: 'balanceHistory',
    title: 'Balance History',
    description: 'Historical balance data',
    icon: BarChart,
    color: 'bg-purple-50 border-purple-200 text-purple-700',
    hoverColor: 'hover:bg-purple-100 hover:border-purple-300'
  },
  {
    id: 'totalBusiness',
    title: 'Total Business',
    description: 'Business overview',
    icon: TrendingUp,
    color: 'bg-indigo-50 border-indigo-200 text-indigo-700',
    hoverColor: 'hover:bg-indigo-100 hover:border-indigo-300'
  },
  {
    id: 'itemMaster',
    title: 'Item Master',
    description: 'Manage items',
    icon: Package,
    color: 'bg-orange-50 border-orange-200 text-orange-700',
    hoverColor: 'hover:bg-orange-100 hover:border-orange-300'
  },
  {
    id: 'analytics',
    title: 'Analytics',
    description: 'Data insights',
    icon: BarChart,
    color: 'bg-teal-50 border-teal-200 text-teal-700',
    hoverColor: 'hover:bg-teal-100 hover:border-teal-300'
  },
  {
    id: 'customers',
    title: 'Customers',
    description: 'Customer management',
    icon: Users,
    color: 'bg-cyan-50 border-cyan-200 text-cyan-700',
    hoverColor: 'hover:bg-cyan-100 hover:border-cyan-300'
  },
  {
    id: 'editBills',
    title: 'Edit Bills',
    description: 'Modify existing bills',
    icon: Edit3,
    color: 'bg-pink-50 border-pink-200 text-pink-700',
    hoverColor: 'hover:bg-pink-100 hover:border-pink-300'
  },
  {
    id: 'editPayments',
    title: 'Edit Payments',
    description: 'Update payment records',
    icon: CreditCard,
    color: 'bg-emerald-50 border-emerald-200 text-emerald-700',
    hoverColor: 'hover:bg-emerald-100 hover:border-emerald-300'
  },
  {
    id: 'recycleBin',
    title: 'Recycle Bin',
    description: 'Deleted items',
    icon: RecycleIcon,
    color: 'bg-gray-50 border-gray-200 text-gray-700',
    hoverColor: 'hover:bg-gray-100 hover:border-gray-300'
  }
];

export const Dashboard = ({ onNavigate }: DashboardProps) => {
  const { effectiveTheme, toggleTheme } = useTheme();
  const [showGlobalSearch, setShowGlobalSearch] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const savedScroll = sessionStorage.getItem('dashboardScroll');
    if (savedScroll && containerRef.current) {
      // Use longer timeout and requestAnimationFrame for reliable scroll restoration
      const timeoutId = setTimeout(() => {
        requestAnimationFrame(() => {
          if (containerRef.current) {
            containerRef.current.scrollTop = parseInt(savedScroll, 10);
          }
        });
      }, 300);
      
      return () => clearTimeout(timeoutId);
    }
  }, []);

  // Save scroll position on unmount
  useEffect(() => {
    return () => {
      if (containerRef.current) {
        sessionStorage.setItem('dashboardScroll', containerRef.current.scrollTop.toString());
      }
    };
  }, []);
  const isDarkMode = effectiveTheme === 'dark';

  return (
    <div ref={containerRef} className="min-h-screen bg-background p-4 md:p-8 overflow-auto">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-start mb-8 gap-4">
          <div className="text-center md:text-left">
            <h1 className="text-4xl font-bold text-foreground mb-2">Prakashbhai</h1>
            <p className="text-muted-foreground text-xl">Bill Manager</p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowGlobalSearch(true)}
              className="modern-button"
            >
              <Search className="w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={toggleTheme}
              className="modern-button"
            >
              {isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onNavigate('settings')}
              className="modern-button"
            >
              <SettingsIcon className="w-4 h-4 mr-2" />
              Settings
            </Button>
          </div>
        </div>

        <GlobalSearch
          open={showGlobalSearch}
          onOpenChange={setShowGlobalSearch}
          onNavigate={onNavigate}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {menuItems.map((item) => {
            const IconComponent = item.icon;
            return (
              <Card
                key={item.id}
                className={`modern-card cursor-pointer ${item.color} ${item.hoverColor} transition-all duration-200`}
                onClick={() => onNavigate(item.id)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-white/50">
                      <IconComponent className="w-6 h-6" />
                    </div>
                    <CardTitle className="text-lg font-semibold">{item.title}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm opacity-80">{item.description}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
};


