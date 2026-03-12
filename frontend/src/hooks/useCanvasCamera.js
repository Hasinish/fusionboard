import { useState, useRef, useCallback, useEffect } from "react";

/**
 * useCanvasCamera
 * Manages the infinite canvas camera state, zooming, panning, and follow mode.
 */
export default function useCanvasCamera() {
    // Current camera view: x, y (offsets), z (zoom level)
    const [camera, setCamera] = useState({ x: 0, y: 0, z: 1 });
    const cameraRef = useRef({ x: 0, y: 0, z: 1 });

    // Target camera for smooth animations
    const targetCameraRef = useRef({ x: 0, y: 0, z: 1 });
    const isAnimatingRef = useRef(false);

    // Follow mode state
    const [followedUserIdState, setFollowedUserIdState] = useState(null);
    const followedUserIdRef = useRef(null);
    
    // Remote states for follow mode logic
    const remoteCamerasRef = useRef({}); // userId -> { x, y, z }

    // Synchronize ref with state for high-frequency access
    useEffect(() => {
        cameraRef.current = camera;
        if (!isAnimatingRef.current) {
            targetCameraRef.current = camera;
        }
    }, [camera]);

    /**
     * Smoothly animates the camera toward targetCameraRef.current
     */
    const startCameraAnimation = useCallback(() => {
        if (isAnimatingRef.current) return;
        isAnimatingRef.current = true;
        
        const animate = () => {
            if (!isAnimatingRef.current) return;
            
            setCamera(prev => {
                const target = targetCameraRef.current;
                const speed = 0.22;
                const dx = (target.x - prev.x) * speed;
                const dy = (target.y - prev.y) * speed;
                const dz = (target.z - prev.z) * speed;
                
                if (Math.abs(dx) < 0.05 && Math.abs(dy) < 0.05 && Math.abs(dz) < 0.0005) {
                    isAnimatingRef.current = false;
                    return target;
                }
                
                requestAnimationFrame(animate);
                return {
                    x: prev.x + dx,
                    y: prev.y + dy,
                    z: prev.z + dz
                };
            });
        };
        requestAnimationFrame(animate);
    }, []);

    /**
     * Custom setter for followedUserId to keep ref in sync
     */
    const setFollowedUserId = useCallback((id) => {
        const nextId = typeof id === 'function' ? id(followedUserIdRef.current) : id;
        followedUserIdRef.current = nextId;
        setFollowedUserIdState(nextId);
    }, []);

    /**
     * Coordinate Transformations
     */
    const screenToWorld = useCallback((sx, sy) => ({
        x: (sx - cameraRef.current.x) / cameraRef.current.z,
        y: (sy - cameraRef.current.y) / cameraRef.current.z,
    }), []);

    const worldToScreen = useCallback((wx, wy) => ({
        x: wx * cameraRef.current.z + cameraRef.current.x,
        y: wy * cameraRef.current.z + cameraRef.current.y,
    }), []);

    return {
        camera, setCamera, cameraRef,
        targetCameraRef, isAnimatingRef,
        startCameraAnimation,
        followedUserId: followedUserIdState,
        setFollowedUserId,
        followedUserIdRef,
        remoteCamerasRef,
        screenToWorld,
        worldToScreen
    };
}
