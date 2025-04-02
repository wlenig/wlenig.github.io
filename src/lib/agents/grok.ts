const  BOARD_SIZE = 50;

class GrokAgent {
    getMove(state: GameState, your_snake_idx: number): Direction {
        // Get my snake and its head
        const mySnake = state.snakes[your_snake_idx];
        const myHead = mySnake.body[mySnake.body.length - 1];
        
        // Determine possible directions (excluding 180-degree turn)
        const possibleDirections = this.getPossibleDirections(mySnake.direction);
        const safeDirections: Direction[] = [];

        // Evaluate each possible direction
        for (const d of possibleDirections) {
            const newHead = this.movePoint(myHead, d);

            // Check if the move is within bounds
            if (!this.isWithinBounds(newHead)) continue;

            // Check collision with own body
            if (this.isPointInBody(newHead, mySnake.body)) continue;

            // Check safety against other snakes' predicted positions
            let isSafe = true;
            for (const otherSnake of state.snakes) {
                if (otherSnake === mySnake) continue;
                const otherHead = otherSnake.body[otherSnake.body.length - 1];
                const predictedNewHead = this.movePoint(otherHead, otherSnake.direction);

                // Predict other snake's new body
                const willEat = state.foods.some(food => 
                    food.x === predictedNewHead.x && food.y === predictedNewHead.y
                );
                let predictedNewBody: Point[];
                if (willEat) {
                    predictedNewBody = [...otherSnake.body, predictedNewHead];
                } else {
                    predictedNewBody = otherSnake.body.slice(1).concat(predictedNewHead);
                }

                // Check for collision with predicted body
                if (this.isPointInBody(newHead, predictedNewBody)) {
                    isSafe = false;
                    break;
                }
            }

            if (isSafe) {
                safeDirections.push(d);
            }
        }

        // Choose the best direction
        if (safeDirections.length > 0) {
            // Find the direction that minimizes distance to nearest food
            let bestDirection = safeDirections[0];
            let minDist = this.distanceToNearestFood(
                this.movePoint(myHead, safeDirections[0]),
                state.foods
            );
            for (const d of safeDirections) {
                const dist = this.distanceToNearestFood(this.movePoint(myHead, d), state.foods);
                if (dist < minDist) {
                    minDist = dist;
                    bestDirection = d;
                }
            }
            return bestDirection;
        } else {
            // No safe direction; choose a default possible direction
            return possibleDirections[0];
        }
    }

    // Helper: Get valid directions excluding the opposite of current direction
    private getPossibleDirections(currentDirection: Direction): Direction[] {
        const opposites: { [key in Direction]: Direction } = {
            'up': 'down',
            'down': 'up',
            'left': 'right',
            'right': 'left'
        };
        const allDirections: Direction[] = ['up', 'down', 'left', 'right'];
        return allDirections.filter(dir => dir !== opposites[currentDirection]);
    }

    // Helper: Calculate new position based on direction
    private movePoint(point: Point, direction: Direction): Point {
        switch (direction) {
            case 'up': return { x: point.x, y: point.y - 1 };
            case 'down': return { x: point.x, y: point.y + 1 };
            case 'left': return { x: point.x - 1, y: point.y };
            case 'right': return { x: point.x + 1, y: point.y };
        }
    }

    // Helper: Check if a point is within the 50x50 grid
    private isWithinBounds(point: Point): boolean {
        return point.x >= 0 && point.x < BOARD_SIZE && point.y >= 0 && point.y < BOARD_SIZE;
    }

    // Helper: Check if a point is in a snake's body
    private isPointInBody(point: Point, body: Point[]): boolean {
        return body.some(p => p.x === point.x && p.y === point.y);
    }

    // Helper: Calculate Manhattan distance to the nearest food
    private distanceToNearestFood(point: Point, foods: Point[]): number {
        if (foods.length === 0) return Number.MAX_SAFE_INTEGER;
        return Math.min(...foods.map(food => 
            Math.abs(point.x - food.x) + Math.abs(point.y - food.y)
        ));
    }
}

export default GrokAgent;