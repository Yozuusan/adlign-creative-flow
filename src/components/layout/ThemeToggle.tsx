import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "next-themes";

export default function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const isDark = theme === "dark";
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label="Toggle theme"
      onClick={() => setTheme(isDark ? "light" : "dark")}
    >
      <Sun className="h-4 w-4 hidden dark:inline" />
      <Moon className="h-4 w-4 inline dark:hidden" />
    </Button>
  );
}
