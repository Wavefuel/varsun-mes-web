export type OrderStatus = 'PLANNED' | 'ACTIVE' | 'COMPLETED';

export interface Order {
    id: string;
    partNumber: string;
    machine: string;
    operator: string;
    date: string; // YYYY-MM-DD
    shift: string;
    startTime: string;
    endTime: string;
    code: string;
    opNumber: number;
    batch: number;
    estPart: string;
    target: number;
    
    // Completion Data
    status: OrderStatus;
    actualOutput?: number;
    toolChanges?: number;
    rejects?: number;
    remarks?: string;
    actualStartTime?: string;
    actualEndTime?: string;
}

export const MOCK_INITIAL_ORDERS: Order[] = [
    {
        id: "WO-55612",
        partNumber: "P-90882-X",
        machine: "CNC-042 (Alpha)",
        operator: "Marcus Jensen",
        date: "2023-10-24",
        shift: "Day (S1)",
        startTime: "06:00",
        endTime: "14:00",
        code: "SH-D24",
        opNumber: 20,
        batch: 450,
        estPart: "1.5m",
        target: 450,
        status: "PLANNED"
    },
    {
        id: "WO-98765",
        partNumber: "XJ-900-V2",
        machine: "CNC-01",
        operator: "Sarah Chen",
        date: "2023-10-24",
        shift: "Day (S1)",
        startTime: "06:00",
        endTime: "14:00",
        code: "SH-D24",
        opNumber: 10,
        batch: 500,
        estPart: "4.5m",
        target: 500,
        status: "COMPLETED",
        actualOutput: 498,
        toolChanges: 1,
        rejects: 0
    },
    {
        id: "WO-33211",
        partNumber: "BW-002-A",
        machine: "CNC-03 (Beta)",
        operator: "Alex R.",
        date: "2023-10-25",
        shift: "Night (S2)",
        startTime: "14:00",
        endTime: "22:00",
        code: "SH-N25",
        opNumber: 30,
        batch: 120,
        estPart: "8.0m",
        target: 120,
        status: "PLANNED"
    }
];
