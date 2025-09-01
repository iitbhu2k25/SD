import { useEffect, useRef, useState, useCallback } from 'react';
import { toast, ToastContainer } from "react-toastify";

export function useWebSocket(url: string, options?: { reconnect?: boolean }) {
  const socketRef = useRef<WebSocket | null>(null);
  const [messages, setMessages] = useState<string[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const reconnectInterval = useRef<NodeJS.Timeout | null>(null);

  const connect = useCallback(() => {
    if (!url) return;

    const socket = new WebSocket(url);
    socketRef.current = socket;

    socket.onopen = () => {
      setIsConnected(true);
      console.log('[WebSocket] Connected');
    };

    socket.onmessage = (event) => {
      if (typeof event.data === 'string') {
        setMessages((prev) => [...prev, event.data]);
      } else {
        // Handle binary data (PDF)
        try {
          const blob = new Blob([event.data], { type: 'application/pdf' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = 'report.pdf';
          a.click();
          URL.revokeObjectURL(url); // Clean up immediately
          toast.success('Report downloaded successfully!');
          socket.close(); // Close WebSocket after download
        } catch (error) {
          console.error('Error downloading PDF:', error);
          toast.error('Failed to download report');
        }
      }
    };

    socket.onclose = () => {
      setIsConnected(false);
      console.log('[WebSocket] Disconnected');
      if (options?.reconnect) {
        reconnectInterval.current = setTimeout(connect, 3000); // Retry in 3s
      }
    };

    socket.onerror = (error) => {
      console.error('[WebSocket] Error:', error);
      socket.close();
      toast.error('WebSocket connection error');
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
      toast.warn('Cannot send message: WebSocket not connected');
    }
  }, []);

  return {
    messages,
    sendMessage,
    isConnected,
  };
}