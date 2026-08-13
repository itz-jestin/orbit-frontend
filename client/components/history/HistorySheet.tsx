import { useEffect, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { Loader2, Trash2, History as HistoryIcon } from "lucide-react";
import { toast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import type { User } from "@/lib/auth";
import {
  deleteHistoryItem,
  fetchHistoryItem,
  fetchHistoryList,
  type HistoryItem,
  type HistoryListItem,
} from "@/lib/history";

interface HistorySheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: User | null;
  onSelect: (item: HistoryItem) => void;
}

export default function HistorySheet({
  open,
  onOpenChange,
  user,
  onSelect,
}: HistorySheetProps) {
  const [items, setItems] = useState<HistoryListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [openingId, setOpeningId] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !user) return;
    setLoading(true);
    fetchHistoryList()
      .then(setItems)
      .catch(() => toast.error("Couldn't load history"))
      .finally(() => setLoading(false));
  }, [open, user]);

  const handleSelect = async (id: string) => {
    setOpeningId(id);
    try {
      const item = await fetchHistoryItem(id);
      onSelect(item);
      onOpenChange(false);
    } catch {
      toast.error("Couldn't open that run");
    } finally {
      setOpeningId(null);
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const prev = items;
    setItems((cur) => cur.filter((i) => i.id !== id));
    try {
      await deleteHistoryItem(id);
    } catch {
      toast.error("Couldn't delete that run");
      setItems(prev);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <HistoryIcon className="h-4 w-4" />
            Research history
          </SheetTitle>
          <SheetDescription>
            {user
              ? "Past runs saved to your account."
              : "Sign in to save and revisit your research runs."}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-2">
          {!user && (
            <p className="text-sm text-muted-foreground">
              You're not signed in, so history isn't available yet.
            </p>
          )}

          {user && loading && (
            <div className="flex items-center justify-center py-10 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          )}

          {user && !loading && items.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No research runs yet. Ask Orbit something to get started.
            </p>
          )}

          {user &&
            !loading &&
            items.map((item) => (
              <button
                key={item.id}
                onClick={() => handleSelect(item.id)}
                disabled={openingId === item.id}
                className="group flex w-full items-start justify-between gap-2 rounded-xl border border-border bg-card/60 p-3.5 text-left transition-colors hover:border-primary/40 disabled:opacity-60"
              >
                <div className="min-w-0">
                  <p className="line-clamp-2 text-sm font-medium text-foreground">
                    {item.query}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(item.created_at), {
                      addSuffix: true,
                    })}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  {openingId === item.id && (
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                  )}
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 opacity-0 transition-opacity group-hover:opacity-100"
                    onClick={(e) => handleDelete(item.id, e)}
                    aria-label="Delete"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </button>
            ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}
