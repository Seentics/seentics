"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useRef, useState, useEffect } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight } from "lucide-react";

const items = [
  {
    title: "Analytics Dashboard",
    image: "/analytics-dashboard.png"
  },
  {
    title: "Heatmaps & Behavior",
    image: "/heatmaps.png"
  },
  {
    title: "Geographical Insights",
    image: "/geography.png"
  },
  {
    title: "Automation Workflows",
    image: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?q=80&w=2426&auto=format&fit=crop"
  },
  {
    title: "Real-time Streaming",
    image: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?q=80&w=2340&auto=format&fit=crop"
  }
];

export default function StickyScrollStack() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [direction, setDirection] = useState(0);

  const slideVariants = {
    enter: (direction: number) => ({
      x: direction > 0 ? 1000 : -1000,
      opacity: 0,
      scale: 0.95
    }),
    center: {
      zIndex: 1,
      x: 0,
      opacity: 1,
      scale: 1,
      transition: {
        x: { type: "spring", stiffness: 300, damping: 30 },
        opacity: { duration: 0.2 }
      }
    },
    exit: (direction: number) => ({
      zIndex: 0,
      x: direction < 0 ? 1000 : -1000,
      opacity: 0,
      scale: 0.95,
      transition: {
        x: { type: "spring", stiffness: 300, damping: 30 },
        opacity: { duration: 0.2 }
      }
    })
  };

  const paginate = (newDirection: number) => {
    setDirection(newDirection);
    setCurrentIndex((prevIndex) => (prevIndex + newDirection + items.length) % items.length);
  };

  // Auto-slide every 5 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      paginate(1);
    }, 5000);
    return () => clearInterval(timer);
  }, [currentIndex]);

  return (
    <section className="relative py-12 md:py-24 bg-background overflow-hidden">
      <div className="container mx-auto px-4">
        <div className="relative h-[300px] md:h-[500px] lg:h-[650px] w-full max-w-7xl mx-auto group">
          <AnimatePresence initial={false} custom={direction}>
            <motion.div
              key={currentIndex}
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              className="absolute inset-0 w-full h-full"
            >
              <div className="relative w-full h-full flex flex-col items-center ">
                {/* Image Container */}
                <div className="relative w-full h-full overflow-hidden p-2 rounded-sm drop-shadow-2xl">
                  <Image
                    src={items[currentIndex].image}
                    alt={items[currentIndex].title}
                    fill
                    className="object-contain drop-shadow-2xl md:drop-shadow-[0_20px_50px_rgba(0,0,0,0.5)]"
                    sizes="100vw"
                    priority
                  />
                  
                  {/* Title Overlay - Made more subtle and detached */}
                  <div className="absolute top-4 inset-x-0 hidden md:flex justify-center z-20">
                    <div className="px-6 py-2 rounded-full bg-background/80 backdrop-blur-md border border-border/50 text-foreground text-sm font-bold shadow-sm">
                      {items[currentIndex].title}
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </AnimatePresence>

          {/* Navigation Controls */}
          <button
            onClick={() => paginate(-1)}
            className="absolute left-4 top-1/2 -translate-y-1/2 z-10 p-3 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-white opacity-0 group-hover:opacity-100 transition-all hover:bg-white/20 active:scale-90"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          
          <button
            onClick={() => paginate(1)}
            className="absolute right-4 top-1/2 -translate-y-1/2 z-10 p-3 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-white opacity-0 group-hover:opacity-100 transition-all hover:bg-white/20 active:scale-90"
          >
            <ChevronRight className="w-6 h-6" />
          </button>

          {/* Indicators */}
          <div className="absolute -bottom-10 inset-x-0 flex justify-center gap-3">
            {items.map((_, index) => (
              <button
                key={index}
                onClick={() => {
                  setDirection(index > currentIndex ? 1 : -1);
                  setCurrentIndex(index);
                }}
                className={`h-1.5 transition-all duration-300 rounded-full ${
                  index === currentIndex ? "w-8 bg-primary" : "w-1.5 bg-border hover:bg-muted-foreground"
                }`}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

