import { useEffect, useRef, useState, useCallback } from 'react';
import { toast } from "react-toastify";

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
          URL.revokeObjectURL(url);
          toast.success('Report downloaded successfully!');
          socket.close(); // Close WebSocket after binary PDF download
        } catch (error) {
          console.log('Error downloading PDF:', error);
          toast.error('Failed to download report');
        }
      }
    };

    socket.onclose = () => {
      setIsConnected(false);
    
      if (options?.reconnect && !reconnectInterval.current) {
        reconnectInterval.current = setTimeout(connect, 3000);
      }
    };

    socket.onerror = (error) => {
      //console.log('[WebSocket] Error:', error);
      socket.close();
      toast.error('WebSocket connection error');
    };
  }, [url, options?.reconnect]);

 const disconnect = useCallback(() => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
     
      socketRef.current.close();
    }
    socketRef.current = null;
    setIsConnected(false);
    setMessages([]);
    if (reconnectInterval.current) {
      clearTimeout(reconnectInterval.current);
      reconnectInterval.current = null;
    }
  }, []);

  useEffect(() => {
    connect();
    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  const sendMessage = useCallback((message: string) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(message);
    } else {
     
      toast.warn('Cannot send message: WebSocket not connected');
    }
  }, []);

  return {
    messages,
    sendMessage,
    isConnected,
    disconnect,
  };
}