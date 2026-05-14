export class Component {}

export class Entity {
  id: string;
  components: Map<Function, Component> = new Map();

  constructor(id: string) {
    this.id = id;
  }

  addComponent(component: Component) {
    this.components.set(component.constructor, component);
    return this;
  }

  getComponent<T extends Component>(type: new (...args: any[]) => T): T | undefined {
    return this.components.get(type) as T;
  }

  removeComponent<T extends Component>(type: new (...args: any[]) => T) {
    this.components.delete(type);
  }
}

export abstract class System {
  abstract update(entities: Map<string, Entity>, delta: number): void;
}

export class WorldECS {
  entities: Map<string, Entity> = new Map();
  systems: System[] = [];

  addEntity(entity: Entity) {
    this.entities.set(entity.id, entity);
  }

  removeEntity(id: string) {
    this.entities.delete(id);
  }

  addSystem(system: System) {
    this.systems.push(system);
  }

  update(delta: number) {
    for (const system of this.systems) {
      system.update(this.entities, delta);
    }
  }
}
