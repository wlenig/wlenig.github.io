// import { Direction, Point, Snake, GameState, Agent } from "../snake";

class ClaudeAgent implements Agent {
  private name: string = "StrategicSnake";

  constructor() {
    console.log(`${this.name} AI initialized`);
  }

  setup(): void {
    console.log(`${this.name} is ready to play`);
  }

  teardown(): void {
    console.log(`${this.name} is shutting down`);
  }

  getMove(state: GameState, your_snake_idx: number): Direction {
    const mySnake = state.snakes[your_snake_idx];
    
    // If snake is dead, return current direction (doesn't matter)
    if (!mySnake.alive) {
      return mySnake.direction;
    }

    const head = mySnake.body[0];
    const possibleMoves = this.getPossibleMoves(mySnake);
    
    // If no valid moves, just return current direction
    if (possibleMoves.length === 0) {
      return mySnake.direction;
    }

    // Calculate safety scores for each possible move
    const moveScores = possibleMoves.map(direction => {
      const nextPos = this.getNextPosition(head, direction);
      
      // Calculate scores based on different factors
      const safetyScore = this.calculateSafetyScore(nextPos, state, mySnake);
      const foodScore = this.calculateFoodScore(nextPos, state.foods);
      const spaceScore = this.calculateSpaceScore(nextPos, state, mySnake);
      
      // Weight the different scores
      const totalScore = safetyScore * 10 + foodScore * 3 + spaceScore * 5;
      
      return { direction, score: totalScore };
    });

    // Sort by score (highest first) and return the best direction
    moveScores.sort((a, b) => b.score - a.score);
    return moveScores[0].direction;
  }

  private getPossibleMoves(snake: Snake): Direction[] {
    const currentDirection = snake.direction;
    const allDirections: Direction[] = ["up", "down", "left", "right"];
    
    // Filter out the opposite direction (can't make 180-degree turns)
    return allDirections.filter(dir => {
      if (currentDirection === "up" && dir === "down") return false;
      if (currentDirection === "down" && dir === "up") return false;
      if (currentDirection === "left" && dir === "right") return false;
      if (currentDirection === "right" && dir === "left") return false;
      return true;
    });
  }

  private getNextPosition(currentPos: Point, direction: Direction): Point {
    const nextPos = { x: currentPos.x, y: currentPos.y };
    
    switch (direction) {
      case "up":
        nextPos.y -= 1;
        break;
      case "down":
        nextPos.y += 1;
        break;
      case "left":
        nextPos.x -= 1;
        break;
      case "right":
        nextPos.x += 1;
        break;
    }
    
    return nextPos;
  }

  private calculateSafetyScore(position: Point, state: GameState, mySnake: Snake): number {
    const BOARD_SIZE = 50;
    let score = 1;
    
    // Check if position is out of bounds
    if (position.x < 0 || position.x >= BOARD_SIZE || 
        position.y < 0 || position.y >= BOARD_SIZE) {
      return 0; // Extremely unsafe - out of bounds
    }
    
    // Check if position collides with any snake body (including our own)
    for (const snake of state.snakes) {
      if (!snake.alive) continue;
      
      // Check each segment of the snake's body
      for (let i = 0; i < snake.body.length; i++) {
        const segment = snake.body[i];
        
        // Skip checking the tail if the snake hasn't eaten (it will move out)
        if (i === snake.body.length - 1) {
          // Check if this snake is about to eat food (tail won't move)
          const head = snake.body[0];
          const isAboutToEat = state.foods.some(
            food => food.x === head.x && food.y === head.y
          );
          
          if (!isAboutToEat) continue;
        }
        
        if (position.x === segment.x && position.y === segment.y) {
          return 0; // Unsafe - collision with snake body
        }
      }
    }
    
    // Check if position has risk of head-to-head collision with a larger snake
    for (const snake of state.snakes) {
      if (!snake.alive || snake === mySnake) continue;
      
      // Only worry about head-to-head with larger or equal size snakes
      if (snake.body.length >= mySnake.body.length) {
        const snakeHead = snake.body[0];
        const potentialNextPositions = this.getPossibleMoves(snake)
          .map(dir => this.getNextPosition(snakeHead, dir));
        
        // If our move could lead to head-to-head collision
        for (const pos of potentialNextPositions) {
          if (pos.x === position.x && pos.y === position.y) {
            return 0.1; // Very unsafe - potential head-to-head with larger snake
          }
        }
      }
    }
    
    // Penalize being close to walls
    if (position.x <= 1 || position.x >= BOARD_SIZE - 2 || 
        position.y <= 1 || position.y >= BOARD_SIZE - 2) {
      score *= 0.8; // Less safe near walls
    }
    
    return score;
  }

  private calculateFoodScore(position: Point, foods: Point[]): number {
    if (foods.length === 0) return 0;
    
    // Find distance to closest food
    let minDistance = Number.MAX_SAFE_INTEGER;
    for (const food of foods) {
      const distance = Math.abs(position.x - food.x) + Math.abs(position.y - food.y);
      minDistance = Math.min(minDistance, distance);
    }
    
    // Return inverse of distance (closer food = higher score)
    // With a maximum value of 1 for food at the position
    return minDistance === 0 ? 1 : 1 / minDistance;
  }

  private calculateSpaceScore(position: Point, state: GameState, mySnake: Snake): number {
    // Simple flood fill to measure available space from this position
    const BOARD_SIZE = 50;
    const visited = Array(BOARD_SIZE).fill(0).map(() => Array(BOARD_SIZE).fill(false));
    
    // Mark all snake bodies as visited
    for (const snake of state.snakes) {
      if (!snake.alive) continue;
      
      for (let i = 0; i < snake.body.length; i++) {
        const segment = snake.body[i];
        // Skip the tail if the snake isn't about to eat
        if (i === snake.body.length - 1) {
          const head = snake.body[0];
          const isAboutToEat = state.foods.some(
            food => food.x === head.x && food.y === head.y
          );
          if (!isAboutToEat) continue;
        }
        
        if (segment.x >= 0 && segment.x < BOARD_SIZE && 
            segment.y >= 0 && segment.y < BOARD_SIZE) {
          visited[segment.y][segment.x] = true;
        }
      }
    }
    
    // Count available space using flood fill (limited depth to save computation)
    const queue: Point[] = [position];
    let spaceCount = 0;
    const maxDepth = 8; // Limit search depth to save computation
    
    while (queue.length > 0 && spaceCount < 64) { // Also limit total spaces to check
      const current = queue.shift()!;
      
      // Skip if out of bounds or already visited
      if (current.x < 0 || current.x >= BOARD_SIZE || 
          current.y < 0 || current.y >= BOARD_SIZE || 
          visited[current.y][current.x]) {
        continue;
      }
      
      // Mark as visited and increment space count
      visited[current.y][current.x] = true;
      spaceCount++;
      
      // Calculate Manhattan distance from starting position
      const distance = Math.abs(current.x - position.x) + Math.abs(current.y - position.y);
      
      // Only add neighbors if we haven't reached max depth
      if (distance < maxDepth) {
        queue.push({ x: current.x + 1, y: current.y });
        queue.push({ x: current.x - 1, y: current.y });
        queue.push({ x: current.x, y: current.y + 1 });
        queue.push({ x: current.x, y: current.y - 1 });
      }
    }
    
    // Return a normalized score between 0 and 1
    return Math.min(spaceCount / 64, 1);
  }
}

export default ClaudeAgent;