import { useEffect, useRef, useState, useCallback } from 'react';
import {toast} from "react-toastify";;

export function useWebSocket(url: string, options?: { reconnect?: boolean }) {
  const socketRef = useRef<WebSocket | null>(null);
  const [messages, setMessages] = useState<string[]>([]);
  const [lastMessage, setLastMessage] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const reconnectInterval = useRef<NodeJS.Timeout | null>(null);
  const reconnectEnabled = useRef(options?.reconnect ?? false);

  useEffect(() => {
    reconnectEnabled.current = options?.reconnect ?? false;
  }, [options?.reconnect]);

  useEffect(() => {
    setMessages([]);
    setLastMessage(null);
    setIsConnected(false);
    
    if (!url) return;

    if (socketRef.current) {
      socketRef.current.close();
      socketRef.current = null;
    }

    if (reconnectInterval.current) {
      clearTimeout(reconnectInterval.current);
      reconnectInterval.current = null;
    }

    const socket = new WebSocket(url);
    socketRef.current = socket;

    socket.onopen = () => {
      setIsConnected(true);
    };

    socket.onmessage = (event) => {
      if (typeof event.data === 'string') {
        setMessages((prev) => [...prev, event.data]);
        setLastMessage(event.data);
      } else {
        try {
          const blob = new Blob([event.data], { type: 'application/pdf' });
          const blobUrl = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = blobUrl;
          a.download = 'report.pdf';
          a.click();
          URL.revokeObjectURL(blobUrl);
          toast.success('Report downloaded successfully!');
          socket.close();
        } catch {
          toast.error('Failed to download report');
        }
      }
    };

    socket.onclose = () => {
      setIsConnected(false);
      socketRef.current = null;

      if (reconnectEnabled.current && !reconnectInterval.current) {
        reconnectInterval.current = setTimeout(() => {
          reconnectInterval.current = null;
        }, 3000);
      }
    };

    socket.onerror = () => {
      socket.close();
      toast.error('WebSocket connection error');
    };

    return () => {
      if (reconnectInterval.current) {
        clearTimeout(reconnectInterval.current);
        reconnectInterval.current = null;
      }
      if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
        socket.close();
      }
      socketRef.current = null;
    };
  }, [url]);

  const disconnect = useCallback(() => {
    reconnectEnabled.current = false;
    if (reconnectInterval.current) {
      clearTimeout(reconnectInterval.current);
      reconnectInterval.current = null;
    }
    if (socketRef.current) {
      socketRef.current.close();
      socketRef.current = null;
    }
    setIsConnected(false);
    setMessages([]);
    setLastMessage(null);
  }, []);

  const sendMessage = useCallback((message: string) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(message);
    } else {
      toast('Cannot send message: WebSocket not connected');
    }
  }, []);

  return {
    messages,
    sendMessage,
    lastMessage,
    isConnected,
    disconnect,
  };
}