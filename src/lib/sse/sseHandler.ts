import { NextResponse } from "next/server";

type Client = {
    id: string;
    userId: string;
    response: any;
};

class SSEHandler {
    private clients: Map<string, Client> = new Map();

    addClient(id: string, userId: string, response: any) {
        //console.log(`[SSE] Adding client: ${id} for user: ${userId}`);
        this.clients.set(id, { id, userId, response });
        //console.log(`[SSE] Total connected clients: ${this.clients.size}`);
    }

    removeClient(id: string) {
        const client = this.clients.get(id);
        this.clients.delete(id);
        //console.log(`[SSE] Removed client: ${id} for user: ${client?.userId}`);
        //console.log(`[SSE] Total connected clients: ${this.clients.size}`);
    }

    broadcastToUser(userId: string, data: any) {
        //console.log(`[SSE] Broadcasting to user: ${userId} with data:`, data);
        for (const client of this.clients.values()) {
            if (client.userId === userId) {
                this.send(client.response, data);
            }
        }
    }

    broadcastAll(data: any) {
        //console.log(`[SSE] Broadcasting to all clients with data:`, data);
        for (const client of this.clients.values()) {
            this.send(client.response, data);
        }
    }

    private send(response: any, data: any) {
        try {
            response.write(`data: ${JSON.stringify(data)}\n\n`);
        } catch (error) {
            console.error(`[SSE] Error sending data:`, error);
        }
    }

    getClientCount() {
        return this.clients.size;
    }
}

const sseHandler = new SSEHandler();
export default sseHandler;