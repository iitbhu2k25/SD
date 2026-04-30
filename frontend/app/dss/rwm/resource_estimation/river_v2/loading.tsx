"use client";
import React from 'react';
import WholeLoading from '@/components/app_layout/newLoading';

export default function Loading() {
  return (
    <div className="w-full h-full min-h-[500px]">
      <WholeLoading 
        visible={true} 
        title="Loading Application" 
        message="Loading River Resource Module..." 
      />
    </div>
  );
}
