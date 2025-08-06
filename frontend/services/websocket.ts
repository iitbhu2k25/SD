// hooks/useWebSocket.ts
import { useEffect, useRef, useState, useCallback } from 'react';

export function useWebSocket(url: string, options?: { reconnect?: boolean }) {
  const socketRef = useRef<WebSocket | null>(null);
  const [messages, setMessages] = useState<string[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const reconnectInterval = useRef<NodeJS.Timeout | null>(null);

  const connect = useCallback(() => {
    if (!url) return;

    const socket = new window.WebSocket(url);
    socketRef.current = socket;

    socket.onopen = () => {
      setIsConnected(true);
      console.log('[WebSocket] Connected');
    };

    socket.onmessage = (event) => {
      if (typeof event.data === 'string') {
        setMessages((prev) => [...prev, event.data]);
      }
      else {
        try{
          const blob = new Blob([event.data], { type: 'application/pdf' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = 'report.pdf';
          a.click();
          setTimeout(() => URL.revokeObjectURL(url), 10000);
        }
        catch (error) {
          console.error('Error downloading PDF:', error);
        }
      }
    };

    socket.onclose = () => {
      setIsConnected(false);
      console.log('[WebSocket] Disconnected');
      if (options?.reconnect) {
        reconnectInterval.current = setTimeout(connect, 3000); // retry in 3s
      }
    };

    socket.onerror = (error) => {
      console.error('[WebSocket] Error:', error);
      socket.close(); // always close on error
    };
  }, [url, options?.reconnect]);

  useEffect(() => {
    connect();
    return () => {
      socketRef.current?.close();
      if (reconnectInterval.current) clearTimeout(reconnectInterval.current);
    };
  }, [connect]);

  const sendMessage = useCallback((message: string) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(message);
    } else {
      console.warn('[WebSocket] Not connected');
    }
  }, []);

  return {
    messages,
    sendMessage,
    isConnected,
  };
}
