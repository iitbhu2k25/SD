
'use client'
import React from "react"

const TimeMethods = () => {
    return (
        <div className="-p-10">
            <div className="flex gap-3 flex-wrap">
                <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-sm font-medium shadow-sm">
                    1. Arithmetic Increase Method
                </span>
                <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-sm font-medium shadow-sm">
                    2. Geometric Increase Method
                </span>
                <span className="bg-purple-100 text-purple-700 px-3 py-1 rounded-full text-sm font-medium shadow-sm">
                    3. Exponential Method
                </span>
                <span className="bg-pink-100 text-pink-700 px-3 py-1 rounded-full text-sm font-medium shadow-sm">
                    4. Incremental Method
                </span>
            </div>
        </div>
    )
}

export default TimeMethods
