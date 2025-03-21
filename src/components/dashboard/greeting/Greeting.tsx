import { useEffect, useState } from "react";
import { format } from "date-fns";
import { useUserData } from "@/contexts/UserDataContext";
import { cn } from "@/lib/utils";
import { Sun, Moon, Sunset } from "lucide-react";

export function Greeting() {
  const [currentTime, setCurrentTime] = useState(new Date());
  const { userData } = useUserData();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Update time every minute
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);

    return () => clearInterval(timer);
  }, []);

  const getGreeting = () => {
    const hour = currentTime.getHours();
    if (hour < 12) return { text: "Good morning", icon: Sun };
    if (hour < 17) return { text: "Good afternoon", icon: Sun };
    return { text: "Good evening", icon: hour < 20 ? Sunset : Moon };
  };

  const { text: greetingText, icon: GreetingIcon } = getGreeting();
  const firstName = userData?.computedFields?.displayName?.split(" ")[0] || "";

  return (
    <>
      {/* Desktop version */}
      <div 
        className={cn(
          "hidden md:flex items-center gap-3 transition-all duration-300",
          mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"
        )}
      >
        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30">
          <GreetingIcon className="w-4 h-4 text-blue-600 dark:text-blue-400" />
        </div>
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <div className="text-sm font-medium text-gray-700 dark:text-gray-200">
              {greetingText}{firstName ? `, ${firstName}` : ""}
            </div>
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">
            {format(currentTime, "EEEE, MMMM d, yyyy • h:mm a")}
          </div>
        </div>
      </div>

      {/* Mobile version */}
      <div 
        className={cn(
          "md:hidden flex items-center transition-all duration-300",
          mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"
        )}
      >
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/30">
            <GreetingIcon className="w-3 h-3 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="flex flex-col">
            <div className="text-xs font-medium text-gray-700 dark:text-gray-200">
              {firstName ? `Hi, ${firstName}` : greetingText}
            </div>
            <div className="text-[10px] text-gray-500 dark:text-gray-400">
              {format(currentTime, "MMM d • h:mm a")}
            </div>
          </div>
        </div>
      </div>
    </>
  );
} 