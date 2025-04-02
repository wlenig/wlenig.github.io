// import {
//     BOARD_SIZE,
//     Direction,
//     Point,
//     Snake,
//     GameState,
//     Agent,
// } from "../snake"; // Assuming the API is in a relative path like this

const BOARD_SIZE = 50; // Assuming a fixed board size for simplicity

// Helper function to check if two points are the same
function isPointEqual(p1: Point, p2: Point): boolean {
    return p1.x === p2.x && p1.y === p2.y;
}

// Helper function to calculate the next head position
function getPotentialHead(head: Point, direction: Direction): Point {
    const nextHead = { ...head };
    switch (direction) {
        case "up":    nextHead.y -= 1; break;
        case "down":  nextHead.y += 1; break;
        case "left":  nextHead.x -= 1; break;
        case "right": nextHead.x += 1; break;
    }
    return nextHead;
}

// Helper function to check if a point is within the board boundaries
function isPointValid(point: Point): boolean {
    return point.x >= 0 && point.x < BOARD_SIZE &&
           point.y >= 0 && point.y < BOARD_SIZE;
}

// Helper function to check if a point is inside a snake's body
// IMPORTANT: excludeTail is crucial for checking self-collision,
// as the snake's actual tail segment will move away in the next step.
function isPointInBody(point: Point, body: Point[], excludeTail: boolean = false): boolean {
    const segmentsToCheck = excludeTail ? body.slice(0, -1) : body;
    return segmentsToCheck.some(segment => isPointEqual(point, segment));
}

// Helper function to calculate Manhattan distance
function manhattanDistance(p1: Point, p2: Point): number {
    return Math.abs(p1.x - p2.x) + Math.abs(p1.y - p2.y);
}

// Helper function to find the nearest food item
function findNearestFood(head: Point, foods: Point[]): Point | null {
    if (foods.length === 0) {
        return null;
    }
    let nearestFood: Point | null = null;
    let minDistance = Infinity;

    for (const food of foods) {
        const distance = manhattanDistance(head, food);
        if (distance < minDistance) {
            minDistance = distance;
            nearestFood = food;
        }
    }
    return nearestFood;
}


export class GeminiAgent implements Agent {
    /**
     * setup is called once at the start of the game.
     */
    setup?(): void {
        console.log("MyAgent Setup");
        // Initialize any agent-specific state here if needed
    }

    /**
     * teardown is called once at the end of the game.
     */
    teardown?(): void {
        console.log("MyAgent Teardown");
        // Clean up any resources if needed
    }

    /**
     * getMove is called once per turn. It must return a valid Direction.
     *
     * @param state The current game state.
     * @param your_snake_idx The index of your snake in the state.snakes array.
     * @returns The chosen direction.
     */
    getMove(state: GameState, your_snake_idx: number): Direction {
        const mySnake: Snake = state.snakes[your_snake_idx];

        // If somehow called when dead, return a default (shouldn't happen in normal flow)
        if (!mySnake.alive) {
            console.warn(`MyAgent ${your_snake_idx} getMove called while dead!`);
            return "up";
        }

        const head: Point = mySnake.body[0];
        const currentDirection: Direction = mySnake.direction;

        const allDirections: Direction[] = ["up", "down", "left", "right"];

        // 1. Determine disallowed 180-degree turn
        let disallowedDirection: Direction | null = null;
        if (mySnake.body.length > 1) { // Only relevant if snake is longer than 1
             switch (currentDirection) {
                case "up":    disallowedDirection = "down"; break;
                case "down":  disallowedDirection = "up"; break;
                case "left":  disallowedDirection = "right"; break;
                case "right": disallowedDirection = "left"; break;
            }
        } else {
            // If snake is length 1, any direction is valid initally.
            // The 'direction' field might still hold the last *intended* move
            // if it died on the first move, but the rule applies based on actual movement.
            // Let's refine based on the *last successfully applied move direction*.
            // If body length is 1, it hasn't moved yet relative to its current single segment,
            // so no direction is truly opposite. But the API provides `direction`, let's respect it.
             switch (currentDirection) {
                case "up":    disallowedDirection = "down"; break;
                case "down":  disallowedDirection = "up"; break;
                case "left":  disallowedDirection = "right"; break;
                case "right": disallowedDirection = "left"; break;
             }
             // It's safer to assume *no* disallowed direction on the very first move decision
             // If steps_elapsed is 0, maybe override? Let's assume the provided direction is meaningful.
        }


        // 2. Filter out the disallowed 180 move
        const possibleMoves = allDirections.filter(dir => dir !== disallowedDirection);

        // 3. Find safe moves (avoid walls, self, other snakes)
        const safeMoves: Direction[] = [];
        for (const move of possibleMoves) {
            const nextHead = getPotentialHead(head, move);

            // Check boundaries
            if (!isPointValid(nextHead)) {
                continue; // Wall collision
            }

            // Check self collision (exclude tail)
            if (isPointInBody(nextHead, mySnake.body, true)) {
                continue; // Self collision
            }

            // Check collision with other snakes (include their tails)
            let collisionWithOther = false;
            for (let i = 0; i < state.snakes.length; i++) {
                if (i === your_snake_idx) continue; // Skip self
                const otherSnake = state.snakes[i];
                if (otherSnake.alive && isPointInBody(nextHead, otherSnake.body, false)) {
                    collisionWithOther = true;
                    break; // Collision detected
                }
            }
            if (collisionWithOther) {
                continue; // Other snake collision
            }

            // If all checks pass, it's a safe move
            safeMoves.push(move);
        }

        // 4. Choose the best move
        if (safeMoves.length === 0) {
            // CRITICAL: No safe moves found! We are trapped.
            // Return *any* valid (non-180) move. Death is inevitable.
            // Pick the first possible move if available, otherwise the current direction (if valid), else 'up'.
            console.warn(`MyAgent ${your_snake_idx}: No safe moves! Choosing fallback.`);
            return possibleMoves.length > 0 ? possibleMoves[0] : (currentDirection !== disallowedDirection ? currentDirection : 'up');
        }

        // 5. Prioritize Food (if safe moves exist)
        const nearestFood = findNearestFood(head, state.foods);
        let bestMove: Direction = safeMoves[0]; // Default to first safe move

        if (nearestFood) {
            let minFoodDistance = Infinity;
            let movesTowardsFood: Direction[] = [];

            for (const move of safeMoves) {
                const nextHead = getPotentialHead(head, move);
                const distance = manhattanDistance(nextHead, nearestFood);

                if (distance < minFoodDistance) {
                    minFoodDistance = distance;
                    movesTowardsFood = [move]; // Start a new list of best moves
                } else if (distance === minFoodDistance) {
                    movesTowardsFood.push(move); // Add to equally good moves
                }
            }

            // If we found moves that get closer, pick one.
            // Prioritize going straight if it's among the best moves.
            if (movesTowardsFood.length > 0) {
                 if (movesTowardsFood.includes(currentDirection)) {
                    bestMove = currentDirection;
                 } else {
                    // Otherwise, just pick the first one found that gets closer
                    bestMove = movesTowardsFood[0];
                 }
            } else {
                 // No move gets closer to food, but we have safe moves.
                 // Try to continue straight if safe, otherwise pick the first safe move.
                 if (safeMoves.includes(currentDirection)) {
                    bestMove = currentDirection;
                 } else {
                    bestMove = safeMoves[0]; // Default wander
                 }
            }
        } else {
            // No food exists. Wander: prioritize going straight if safe.
            if (safeMoves.includes(currentDirection)) {
                bestMove = currentDirection;
            } else {
                // Otherwise just pick the first available safe move.
                bestMove = safeMoves[0];
            }
        }

        return bestMove;
    }
}

// Example of how you might export the agent for the game runner
// (The exact export mechanism might depend on the game framework)
export default GeminiAgent;