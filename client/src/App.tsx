import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { AppLayout } from "./components/AppLayout";
import Dashboard from "./pages/Dashboard";
import Giststack from "./pages/Giststack";
import Ideas from "./pages/Ideas";
import Research from "./pages/Research";
import Writer from "./pages/Writer";
import Publications from "./pages/Publications";
import Pitches from "./pages/Pitches";
import Financial from "./pages/Financial";
import Settings from "./pages/Settings";
import NotFound from "@/pages/NotFound";

function Router() {
  return (
    <AppLayout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/giststack" component={Giststack} />
        <Route path="/ideas" component={Ideas} />
        <Route path="/research" component={Research} />
        <Route path="/writer" component={Writer} />
        <Route path="/writer/:id" component={Writer} />
        <Route path="/publications" component={Publications} />
        <Route path="/pitches" component={Pitches} />
        <Route path="/financial" component={Financial} />
        <Route path="/settings" component={Settings} />
        <Route path="/404" component={NotFound} />
        <Route component={NotFound} />
      </Switch>
    </AppLayout>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
