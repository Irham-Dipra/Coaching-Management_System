// We might not need the repository if we use direct API calls or reuse generic patterns, 
// strictly speaking, we agreed to use Repositories for consistency.

const API_URL = 'http://127.0.0.1:8000';

export interface Room {
    room_id: number;
    room_name: string;
    capacity?: number;
}


export interface ScheduleWindow {
    window_id: number;
    room_id: number;
    room_name?: string;
    room?: { room_name: string }; // Handle nested or flat
    day_of_week: string;
    start_time: string; // HH:MM:SS
    end_time: string;
    window_name?: string;

    // For joined data (Legacy)
    program_schedule?: {
        program: {
            program_id: number;
            program_name: string;
        }
    }[];
    // New Flat Structure from View
    programs?: {
        program_id: number;
        program_name: string;
    }[];
    student_count?: number;
}

export const ScheduleRepository = {
    // ROOMS
    getRooms: async (): Promise<Room[]> => {
        const response = await fetch(`${API_URL}/rooms`);
        if (!response.ok) throw new Error('Failed to fetch rooms');
        return response.json();
    },

    createRoom: async (room_name: string, capacity?: number): Promise<Room> => {
        const response = await fetch(`${API_URL}/rooms`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ room_name, capacity })
        });
        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.detail || 'Failed to create room');
        }
        return response.json();
    },

    deleteRoom: async (room_id: number): Promise<void> => {
        const response = await fetch(`${API_URL}/rooms/${room_id}`, { method: 'DELETE' });
        if (!response.ok) throw new Error('Failed to delete room');
    },

    // WINDOWS
    getAllWindows: async (): Promise<ScheduleWindow[]> => {
        const response = await fetch(`${API_URL}/schedule-windows`);
        if (!response.ok) throw new Error('Failed to fetch schedule');
        return response.json();
    },

    searchWindows: async (filters: { room_id?: number, day?: string, program_id?: number }): Promise<ScheduleWindow[]> => {
        const params = new URLSearchParams();
        if (filters.room_id) params.append('room_id', filters.room_id.toString());
        if (filters.day) params.append('day', filters.day);
        if (filters.program_id) params.append('program_id', filters.program_id.toString());

        const response = await fetch(`${API_URL}/schedule-windows/search?${params.toString()}`);
        if (!response.ok) throw new Error('Failed to search windows');
        return response.json();
    },

    getWindowDetails: async (windowId: string) => {
        const res = await fetch(`${API_URL}/schedule-windows/${windowId}`);
        if (!res.ok) throw new Error('Fetch failed');
        return res.json();
    },

    updateWindow: async (windowId: string, data: any) => {
        const res = await fetch(`${API_URL}/schedule-windows/${windowId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        if (!res.ok) throw new Error('Update failed');
        return res.json();
    },

    createWindow: async (data: any): Promise<ScheduleWindow> => {
        const response = await fetch(`${API_URL}/schedule-windows`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.detail || 'Failed to create slot');
        }
        return response.json();
    },

    deleteWindow: async (window_id: number): Promise<void> => {
        const response = await fetch(`${API_URL}/schedule-windows/${window_id}`, { method: 'DELETE' });
        if (!response.ok) throw new Error('Failed to delete slot');
    },

    // ASSIGNMENT
    getProgramSchedule: async (program_id: number): Promise<ScheduleWindow[]> => {
        const response = await fetch(`${API_URL}/programs/${program_id}/schedule`);
        if (!response.ok) throw new Error('Failed to fetch program schedule');
        return response.json();
    },

    assignSchedule: async (program_id: number, window_ids: number[]): Promise<void> => {
        const response = await fetch(`${API_URL}/programs/schedule-assign`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ program_id, window_ids })
        });
        if (!response.ok) throw new Error('Failed to update schedule');
    }
};
