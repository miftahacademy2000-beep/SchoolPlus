import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Home, ArrowLeft, Search, GraduationCap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { motion } from "framer-motion";

const quickLinks = [
  { label: "Dashboard", path: "/" },
  { label: "Schools", path: "/schools" },
  { label: "Students", path: "/students" },
  { label: "Teachers", path: "/teachers" },
  { label: "Classes", path: "/classes" },
  { label: "Settings", path: "/settings" },
];

const NotFound = () => {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");

  const filtered = quickLinks.filter((l) =>
    l.label.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen flex items-center justify-center bg-background relative overflow-hidden">
      {/* Decorative background blobs */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 -left-32 w-96 h-96 rounded-full bg-primary/5 blur-3xl" />
        <div className="absolute bottom-1/4 -right-32 w-96 h-96 rounded-full bg-primary/8 blur-3xl" />
      </div>

      <div className="relative text-center max-w-lg mx-auto px-6">
        {/* Logo */}
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4 }}
          className="flex items-center justify-center gap-2 mb-10"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <GraduationCap className="h-6 w-6" />
          </div>
          <span className="text-xl font-bold text-foreground">EduFlow</span>
        </motion.div>

        {/* 404 number */}
        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="text-[8rem] leading-none font-extrabold tracking-tighter"
          style={{ background: "var(--gradient-primary)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}
        >
          404
        </motion.h1>

        {/* Message */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.25 }}
          className="mt-2 mb-8"
        >
          <h2 className="text-2xl font-semibold text-foreground mb-2">
            Page not found
          </h2>
          <p className="text-muted-foreground">
            Sorry, the page you're looking for doesn't exist or has been moved.
          </p>
        </motion.div>

        {/* Search bar */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="mb-6"
        >
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search for a page..."
              className="pl-10"
              onKeyDown={(e) => {
                if (e.key === "Enter" && filtered.length > 0) {
                  navigate(filtered[0].path);
                }
              }}
            />
          </div>

          {/* Quick links */}
          {search ? (
            filtered.length > 0 ? (
              <div className="mt-3 rounded-lg border border-border bg-card p-2 text-left shadow-sm">
                {filtered.map((link) => (
                  <Link
                    key={link.path}
                    to={link.path}
                    className="block rounded-md px-3 py-2 text-sm text-foreground hover:bg-accent transition-colors"
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">No pages found.</p>
            )
          ) : (
            <div className="mt-3 flex flex-wrap justify-center gap-2">
              {quickLinks.slice(0, 4).map((link) => (
                <Link
                  key={link.path}
                  to={link.path}
                  className="rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground hover:text-foreground hover:border-primary/30 transition-colors"
                >
                  {link.label}
                </Link>
              ))}
            </div>
          )}
        </motion.div>

        {/* Action buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.55 }}
          className="flex flex-col sm:flex-row gap-3 justify-center"
        >
          <Button variant="outline" className="gap-2" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4" />
            Go back
          </Button>
          <Button asChild className="gap-2">
            <Link to="/">
              <Home className="h-4 w-4" />
              Home
            </Link>
          </Button>
        </motion.div>
      </div>
    </div>
  );
};

export default NotFound;
