// const { BOARD_SIZE } = require("../snake");
const BOARD_SIZE = 50;

class MyAgent implements Agent {
    getMove(state: GameState, your_snake_idx: number): Direction {
        const yourSnake = state.snakes[your_snake_idx];
        const head = yourSnake.body[0];
        const currentDir = yourSnake.direction;

        // Generate possible directions
        const possibleDirs: Direction[] = [];
        if (yourSnake.body.length === 1) {
            possibleDirs.push("up", "down", "left", "right");
        } else {
            const oppositeDir = this.getOppositeDirection(currentDir);
            (["up", "down", "left", "right"] as Direction[]).forEach(dir => {
                if (dir !== oppositeDir) {
                    possibleDirs.push(dir);
                }
            });
        }

        // Check validity of each direction
        const validDirs: Direction[] = [];
        for (const dir of possibleDirs) {
            const newHead = this.computeNewHead(head, dir);
            if (this.isOutOfBounds(newHead)) {
                continue;
            }
            if (this.isCollision(newHead, state)) {
                continue;
            }
            validDirs.push(dir);
        }

        // If no valid directions, return first possible or current
        if (validDirs.length === 0) {
            return possibleDirs[0] || currentDir;
        }

        // Find closest food
        const closestFood = this.findClosestFood(head, state.foods);
        if (!closestFood) {
            // No food, prefer current direction if valid
            if (validDirs.includes(currentDir)) {
                return currentDir;
            }
            return validDirs[0];
        }

        // Choose direction that moves towards closest food
        let bestDir: Direction = validDirs[0];
        let minDist = Infinity;
        for (const dir of validDirs) {
            const newHead = this.computeNewHead(head, dir);
            const dist = this.manhattanDistance(newHead, closestFood);
            if (dist < minDist) {
                minDist = dist;
                bestDir = dir;
            } else if (dist === minDist) {
                // Tie-break: prefer current direction
                if (dir === currentDir) {
                    bestDir = dir;
                }
            }
        }

        return bestDir;
    }

    private computeNewHead(head: Point, dir: Direction): Point {
        let x = head.x;
        let y = head.y;
        switch (dir) {
            case "up":
                y += 1;
                break;
            case "down":
                y -= 1;
                break;
            case "left":
                x -= 1;
                break;
            case "right":
                x += 1;
                break;
        }
        return { x, y };
    }

    private isOutOfBounds(point: Point): boolean {
        return point.x < 0 || point.x >= BOARD_SIZE || point.y < 0 || point.y >= BOARD_SIZE;
    }

    private isCollision(newHead: Point, state: GameState): boolean {
        for (const snake of state.snakes) {
            // Check all body parts except the tail
            for (let i = 0; i < snake.body.length - 1; i++) {
                const part = snake.body[i];
                if (part.x === newHead.x && part.y === newHead.y) {
                    return true;
                }
            }
        }
        return false;
    }

    private findClosestFood(head: Point, foods: Point[]): Point | null {
        if (foods.length === 0) return null;
        let closest = foods[0];
        let minDist = this.manhattanDistance(head, closest);
        for (const food of foods) {
            const dist = this.manhattanDistance(head, food);
            if (dist < minDist) {
                closest = food;
                minDist = dist;
            }
        }
        return closest;
    }

    private manhattanDistance(a: Point, b: Point): number {
        return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
    }

    private getOppositeDirection(dir: Direction): Direction {
        switch (dir) {
            case "up":
                return "down";
            case "down":
                return "up";
            case "left":
                return "right";
            case "right":
                return "left";
        }
    }
}

export default MyAgent;