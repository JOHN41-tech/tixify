import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import EventPage from "./pages/EventPage";
import CheckoutPage from "./pages/CheckoutPage";
import BookingPage from "./pages/BookingPage";
import TicketsPage from "./pages/TicketsPage";
import { AdminPage, LoginPage } from "./pages/UtilityPages";

function Router() {
  return <Switch>
    <Route path="/" component={Home} />
    <Route path="/events" component={Home} />
    <Route path="/events/:eventId" component={EventPage} />
    <Route path="/events/:eventId/seats" component={EventPage} />
    <Route path="/checkout" component={CheckoutPage} />
    <Route path="/booking/:bookingId" component={BookingPage} />
    <Route path="/tickets" component={TicketsPage} />
    <Route path="/account/bookings" component={TicketsPage} />
    <Route path="/login" component={LoginPage} />
    <Route path="/register" component={LoginPage} />
    <Route path="/admin" component={AdminPage} />
    <Route path="/admin/events" component={AdminPage} />
    <Route path="/admin/bookings" component={AdminPage} />
    <Route path="/admin/inventory" component={AdminPage} />
    <Route path="/404" component={NotFound} />
    <Route component={NotFound} />
  </Switch>;
}

export default function App() {
  return <ErrorBoundary><ThemeProvider defaultTheme="light"><TooltipProvider><Toaster /><Router /></TooltipProvider></ThemeProvider></ErrorBoundary>;
}
