"use client";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

type Noti = { id: string; title: string; body: string; link?: string; readAt?: string; createdAt: string };

export function NotificationBell() {
  const [items, setItems] = useState<Noti[]>([]);
  const [unread, setUnread] = useState(0);

  const load = useCallback(async () => {
    const res = await fetch("/api/notifications");
    if (!res.ok) return;
    const data = await res.json();
    setItems(data.items); setUnread(data.unread);
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 60_000);
    return () => clearInterval(t);
  }, [load]);

  const markAllRead = async () => {
    await fetch("/api/notifications", { method: "PATCH" });
    load();
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label="알림">
          <Bell className="h-5 w-5" />
          {unread > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-medium text-white">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96 p-0">
        <div className="flex items-center justify-between border-b px-4 py-2.5">
          <p className="text-sm font-medium">알림</p>
          {unread > 0 && (
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={markAllRead}>모두 읽음</Button>
          )}
        </div>
        <div className="max-h-96 overflow-y-auto">
          {items.length === 0 && (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">새 알림이 없습니다</p>
          )}
          {items.map((n) => (
            <Link
              key={n.id}
              href={n.link ?? "#"}
              onClick={() => fetch("/api/notifications", { method: "PATCH", body: JSON.stringify({ id: n.id }) })}
              className={`block border-b px-4 py-3 last:border-0 hover:bg-accent/50 ${n.readAt ? "opacity-60" : ""}`}
            >
              <p className="text-sm font-medium">{n.title}</p>
              <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{n.body}</p>
              <p className="mt-1 text-[11px] text-muted-foreground">{new Date(n.createdAt).toLocaleString("ko-KR")}</p>
            </Link>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
