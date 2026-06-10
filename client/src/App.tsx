import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { AppLayout } from "./components/AppLayout";
import Dashboard from "./pages/Dashboard";
import WorkspaceShell from "./workspace/WorkspaceShell";
import Giststack from "./pages/Giststack";
import Ideas from "./pages/Ideas";
import Research from "./pages/Research";
import Writer from "./pages/Writer";
import Publications from "./pages/Publications";
import Pitches from "./pages/Pitches";
import Financial from "./pages/Financial";
import Settings from "./pages/Settings";
import Brands from "./pages/Brands";
import Queue from "./pages/Queue";
import Social from "./pages/Social";
import ContentLibrary from "./pages/Library";
import Geo from "./pages/Geo";
import Strategy from "./pages/Strategy";
import Pipeline from "./pages/Pipeline";
import Login from "./pages/Login";
import Agents from "./pages/Agents";
import PulsePipeline from "./pages/PulsePipeline";
import Trending from "./pages/Trending";
import ContentStudio from "./pages/ContentStudio";
import ContentCalendar from "./pages/ContentCalendar";
import ContentInsights from "./pages/ContentInsights";
import Interviews from "./pages/Interviews";
import BrandVoice from "./pages/BrandVoice";
import NotFound from "@/pages/NotFound";
function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route>
        <AppLayout>
          <Switch>
            <Route path="/" component={Dashboard} />
            <Route path="/giststack" component={Giststack} />
            <Route path="/workspace" component={WorkspaceShell} />
            <Route path="/ideas" component={Ideas} />
            <Route path="/research" component={Research} />
            <Route path="/writer" component={Writer} />
            <Route path="/writer/:id" component={Writer} />
            <Route path="/queue" component={Queue} />
            <Route path="/agents" component={Agents} />
            <Route path="/publications" component={Publications} />
            <Route path="/pitches" component={Pitches} />
            <Route path="/financial" component={Financial} />
            <Route path="/social" component={Social} />
            <Route path="/library" component={ContentLibrary} />
            <Route path="/geo" component={Geo} />
            <Route path="/strategy" component={Strategy} />
            <Route path="/pipeline" component={Pipeline} />
            <Route path="/pulse" component={PulsePipeline} />
            <Route path="/trending" component={Trending} />
            <Route path="/content-studio" component={ContentStudio} />
            <Route path="/content-calendar" component={ContentCalendar} />
            <Route path="/content-insights" component={ContentInsights} />
            <Route path="/interviews" component={Interviews} />
            <Route path="/brand-voice" component={BrandVoice} />
            <Route path="/brands" component={Brands} />
            <Route path="/settings" component={Settings} />
            <Route path="/404" component={NotFound} />
            <Route component={NotFound} />
          </Switch>
        </AppLayout>
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark" switchable={true}>
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
