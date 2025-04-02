const BOARD_SIZE = 50;

const DIRECTIONS: Direction[] = ["up", "down", "left", "right"];
const OPPOSITE_DIRECTION: Record<Direction, Direction> = {
    up: "down",
    down: "up",
    left: "right",
    right: "left",
};

function getValidMoves(state: GameState, snake: Snake): Direction[] {
    const { body, direction } = snake;
    const head = body[0];
    const occupied = new Set(state.snakes.flatMap(s => s.body.map(p => `${p.x},${p.y}`)));
    
    return DIRECTIONS.filter(dir => {
        if (dir === OPPOSITE_DIRECTION[direction]) return false; // No 180-degree turns
        
        const newHead = movePoint(head, dir);
        if (newHead.x < 0 || newHead.x >= BOARD_SIZE || newHead.y < 0 || newHead.y >= BOARD_SIZE) return false; // Out of bounds
        
        return !occupied.has(`${newHead.x},${newHead.y}`); // Collision check
    });
}

function movePoint(point: Point, direction: Direction): Point {
    switch (direction) {
        case "up": return { x: point.x, y: point.y - 1 };
        case "down": return { x: point.x, y: point.y + 1 };
        case "left": return { x: point.x - 1, y: point.y };
        case "right": return { x: point.x + 1, y: point.y };
    }
}

function findClosestFood(head: Point, foods: Point[]): Point | null {
    if (foods.length === 0) return null;
    return foods.reduce((closest, food) => 
        (Math.abs(food.x - head.x) + Math.abs(food.y - head.y) < Math.abs(closest.x - head.x) + Math.abs(closest.y - head.y))
            ? food : closest
    );
}

const ChatGPTAgent: Agent = {
    getMove(state, your_snake_idx) {
        const snake = state.snakes[your_snake_idx];
        if (!snake.alive) return "up"; // Default safe move (never used since snake is dead)
        
        const validMoves = getValidMoves(state, snake);
        if (validMoves.length === 0) return snake.direction; // No options, keep moving in the same direction
        
        const closestFood = findClosestFood(snake.body[0], state.foods);
        if (closestFood) {
            validMoves.sort((a, b) => {
                const newA = movePoint(snake.body[0], a);
                const newB = movePoint(snake.body[0], b);
                return (Math.abs(newA.x - closestFood.x) + Math.abs(newA.y - closestFood.y)) -
                       (Math.abs(newB.x - closestFood.x) + Math.abs(newB.y - closestFood.y));
            });
        }
        
        return validMoves[0]; // Pick the best move based on food proximity
    }
};

export default ChatGPTAgent;