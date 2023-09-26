/*
 * Copyright (C) 2023 Xiaomi Corporation.  All rights reserved.
 * SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
 */

import { ValueType } from './value_types.js';
import { Type } from '../type.js';

import { InternalNames } from './internal.js';
import { DumpWriter, CreateDefaultDumpWriter } from './dump.js';
import { SemanticsValue } from './value.js';

export enum MemberType {
    FIELD = 1,
    METHOD,
    CONSTRUCTOR,
    ACCESSOR,
}

export interface MemberOrAccessor {
    method?: Value;
    getter?: Value;
    setter?: Value;
}

export enum MemberModifier {
    READONLY = 1,
}

export class MemberDescription {
    private _flags = 0;
    /* use modifier to represent readonly */
    public modifiers = 0;
    constructor(
        public readonly name: string,
        public readonly type: MemberType,
        public readonly index: number,
        public readonly isOptional: boolean,
        public valueType: ValueType, // we will reset the value
        public methodOrAccessor?: MemberOrAccessor,
        public isOwn = true,
        public isStaic = false,
        public staticFieldInitValue: SemanticsValue | undefined = undefined,
        public isDeclaredCtor = true /** true iff explicitly write constructor(..) */,
    ) {}

    get isOverrid(): boolean {
        return (this._flags & 1) == 1;
    }
    setOverrid() {
        this._flags |= 1;
    }

    set offset(off: number) {
        this._flags = (off << 2) | (this._flags & 3);
    }
    get offset(): number {
        return this._flags >> 2;
    }

    set getterOffset(off: number) {
        this.offset = ((this.offset & 0x7fff) << 15) | (off & 0x7fff);
    }
    get getterOffset(): number {
        return this.offset & 0x7fff;
    }
    set setterOffset(off: number) {
        this.offset = (this.offset & 0x7fff) | ((off & 0x7fff) << 15);
    }
    get setterOffset(): number {
        return (this.offset >> 15) & 0x7fff;
    }

    toString(): string {
        let s = `${this.name} ${MemberType[this.type]} @${this.index} ${
            this.isOverrid ? 'overrided' : ''
        } type: ${this.valueType}`;
        if (this.type == MemberType.ACCESSOR) {
            s = `${s} getter: ${this.getterOffset} setter: ${this.setterOffset}`;
        } else {
            s = `${s} offset: ${this.offset}`;
        }
        return s;
    }

    setAccessorFunction(func: Value, is_setter: boolean) {
        if (this.methodOrAccessor) {
            const obj = this.methodOrAccessor;
            if (is_setter) obj.setter = func;
            else obj.getter = func;
        } else {
            this.methodOrAccessor = is_setter
                ? { setter: func }
                : { getter: func };
        }
    }

    get hasGetter(): boolean {
        return (
            this.type == MemberType.ACCESSOR &&
            !!this.methodOrAccessor &&
            !!this.methodOrAccessor!.getter
        );
    }
    get hasSetter(): boolean {
        return (
            this.type == MemberType.ACCESSOR &&
            !!this.methodOrAccessor &&
            !!this.methodOrAccessor!.setter
        );
    }

    get getter(): Value | undefined {
        return this.hasGetter ? this.methodOrAccessor!.getter : undefined;
    }

    get setter(): Value | undefined {
        return this.hasSetter ? this.methodOrAccessor!.setter : undefined;
    }

    get method(): Value | undefined {
        return this.type == MemberType.METHOD && this.methodOrAccessor
            ? this.methodOrAccessor!.method
            : undefined;
    }
}

export enum ObjectDescriptionType {
    OBJECT_LITERAL,
    INTERFACE,
    OBJECT_INSTANCE,
    OBJECT_CLASS,
}

export class ObjectDescription {
    private _clazz_or_instance?: ObjectDescription; // class of this instance
    public originShape?: Shape;
    public thisShape?: Shape;
    public compatibleShapes = new Map<ObjectDescription, Shape>();
    public members: MemberDescription[] = [];
    public fieldCount = 0;
    public drived = 0;
    private _base?: ObjectDescription;
    private _inited = false;
    private _builtin = false;
    public ctor?: MemberDescription;

    get isInited(): boolean {
        return this._inited;
    }
    setInited() {
        this._inited = true;
    }

    get isBuiltin(): boolean {
        return this._builtin;
    }
    setBuiltin() {
        this._builtin = true;
    }

    get base(): ObjectDescription | undefined {
        return this._base;
    }
    set base(b: ObjectDescription | undefined) {
        this._base = b;
        if (b) b.drived++;
    }

    get generic(): ObjectDescription {
        return this._generic ? this._generic : this;
    }

    get hasGeneric(): boolean {
        return !!this._generic;
    }

    constructor(
        public readonly name: string,
        public readonly type: ObjectDescriptionType,
        private readonly _generic?: ObjectDescription,
    ) {}

    get isLiteral(): boolean {
        return this.type == ObjectDescriptionType.OBJECT_LITERAL;
    }
    get isInterface(): boolean {
        return this.type == ObjectDescriptionType.INTERFACE;
    }
    get isObjectInstance(): boolean {
        return this.type == ObjectDescriptionType.OBJECT_INSTANCE;
    }
    get isObjectClass(): boolean {
        return this.type == ObjectDescriptionType.OBJECT_CLASS;
    }

    get instance(): ObjectDescription | undefined {
        return this.isObjectClass ? this._clazz_or_instance : this;
    }

    set instance(inst: ObjectDescription | undefined) {
        if (this.isObjectClass) this._clazz_or_instance = inst;
    }

    get clazz(): ObjectDescription | undefined {
        if (this.isObjectClass) return this;
        if (this.isObjectInstance) return this._clazz_or_instance;
        return undefined;
    }

    set clazz(c: ObjectDescription | undefined) {
        if (this.isObjectInstance) this._clazz_or_instance = c;
    }

    findMember(name: string): MemberDescription | undefined {
        return this.members.find((m) => m && name == m.name);
    }

    findConstructor(): MemberDescription | undefined {
        return this.findMember(InternalNames.CONSTRUCTOR);
        // return this.ctor;
    }

    updateMember(
        name: string,
        i: number,
        type: MemberType,
        is_optional = false,
        valueType: ValueType,
        is_own: boolean,
        methodOrAccessor?: MemberOrAccessor,
        is_static = false,
        static_field_init_value: SemanticsValue | undefined = undefined,
    ): MemberDescription {
        let super_member: MemberDescription | undefined = undefined;
        if (this._base && name !== 'constructor') {
            super_member = this._base.findMember(name);
        }

        let index = i;
        let slot = i;

        if (super_member) {
            index = super_member.index;
            // super member is override
            super_member.setOverrid();
            slot = index;
            /* spread accessor flags */
            if (!is_own) {
                methodOrAccessor = super_member.methodOrAccessor;
            }
        } else {
            slot = this.findFreeSlot(slot);
        }

        this.members[slot] = new MemberDescription(
            name,
            type,
            index,
            is_optional,
            valueType,
            methodOrAccessor,
            is_own,
            is_static,
            static_field_init_value,
        );

        return this.members[slot];
    }

    findFreeSlot(start: number): number {
        while (start < this.members.length && this.members[start]) {
            start++;
        }
        if (start >= this.members.length) {
            throw Error(
                `Cannot found a free slot for member of ${this.name} member start: ${start} member count: ${this.members.length}`,
            );
        }
        return start;
    }

    buildShape(from: Shape): Shape {
        const from_meta = from.meta;
        if (this.compatibleShapes.has(from_meta))
            return this.compatibleShapes.get(from_meta)!;

        if (this.hasGeneric) {
            const new_generice_shape = this.generic.buildShape(
                from.genericShape,
            );
            const new_shape = new Shape(this, new_generice_shape);
            new_shape.members = new_generice_shape.members;
            this.compatibleShapes.set(from_meta, new_shape);
            return new_shape;
        }

        // else
        const new_shape = new Shape(this);
        const members = new Array<ShapeMember>(this.members.length);
        for (let i = 0; i < this.members.length; i++) {
            const to_member = this.members[i];
            const to_index = to_member.index;
            const from_member = from_meta.findMember(to_member.name);
            if (from_member) {
                if (
                    from_member.type == to_member.type ||
                    ((from_member.type == MemberType.FIELD ||
                        from_member.type == MemberType.ACCESSOR) &&
                        (to_member.type == MemberType.FIELD ||
                            to_member.type == MemberType.ACCESSOR))
                ) {
                    const m = from.getMember(from_member.index);
                    if (m) {
                        members[to_index] = m;
                    }
                }
            }
        }
        new_shape.members = members;
        this.compatibleShapes.set(from_meta, new_shape);
        return new_shape;
    }

    dump(writer: DumpWriter) {
        writer.write(
            `ObjectDescript: ${this.name} [${
                ObjectDescriptionType[this.type]
            }] {`,
        );
        writer.shift();
        writer.write(`fieldCount: ${this.fieldCount}`);
        writer.write(`drived: ${this.drived}`);
        writer.write(`super: ${this._base ? this._base.name : '<NO BASE>'}`);
        writer.write(`members: [`);
        writer.shift();
        for (const m of this.members) {
            writer.write(m.toString());
        }
        writer.unshift();
        if (this.originShape) {
            if (this.originShape === this.thisShape) {
                writer.write(`originShape & thisShape:`);
            } else {
                writer.write(`originShape:`);
            }
            writer.shift();
            this.originShape.dump(writer);
            writer.unshift();
        }

        if (this.thisShape && this.thisShape !== this.originShape) {
            writer.write(`thisShape:`);
            writer.shift();
            this.thisShape.dump(writer);
            writer.unshift();
        }

        writer.write(`compatibleShapes: [`);
        writer.shift();
        this.compatibleShapes.forEach((shape, od) => {
            writer.write(`from ${od.name}`);
            shape.dump(writer);
        });
        writer.unshift();
        writer.write(`]`);

        writer.unshift();
        writer.write(`}`);
    }
}

export const UnknownObjectDescription = new ObjectDescription(
    'UnknownObject',
    ObjectDescriptionType.INTERFACE,
);

export interface Value {
    shape?: Shape;
}

export enum ShapeMemberStorage {
    OFFSET, // the member offset
    VALUE,
}

export class ShapeMember {
    constructor(
        public readonly kind: MemberType,
        public readonly storage: ShapeMemberStorage,
    ) {}

    get isOffset(): boolean {
        return this.storage == ShapeMemberStorage.OFFSET;
    }
    get isValue(): boolean {
        return this.storage == ShapeMemberStorage.VALUE;
    }

    get isEmpty(): boolean {
        return true;
    }

    dump(writer: DumpWriter) {
        writer.write(this.toString());
    }
}

export class ShapeField extends ShapeMember {
    constructor(public readonly offset?: number) {
        super(MemberType.FIELD, ShapeMemberStorage.OFFSET);
    }

    get isEmpty(): boolean {
        return this.offset == undefined;
    }

    toString(): string {
        return `ShapeField: offset ${
            this.offset != undefined ? this.offset : '<NULL>'
        }`;
    }
}

export class ShapeAccessor extends ShapeMember {
    constructor(
        storage: ShapeMemberStorage,
        private _getter?: Value | number,
        private _setter?: Value | number,
    ) {
        super(MemberType.ACCESSOR, storage);
    }

    get getterOffset(): number | undefined {
        return this._getter !== undefined && this.isOffset
            ? (this._getter! as number)
            : undefined;
    }

    get getterValue(): Value | undefined {
        return this._getter !== undefined && this.isValue
            ? (this._getter! as Value)
            : undefined;
    }

    get getter(): Value | number | undefined {
        return this._getter;
    }
    get setter(): Value | number | undefined {
        return this._setter;
    }

    get setterOffset(): number | undefined {
        return this._setter !== undefined && this.isOffset
            ? (this._setter! as number)
            : undefined;
    }

    get setterValue(): Value | undefined {
        return this._setter !== undefined && this.isValue
            ? (this._setter! as Value)
            : undefined;
    }

    get isEmpty(): boolean {
        return this._getter == undefined && this._setter == undefined;
    }

    toString(): string {
        return `ShapeAccessor: ${this.isOffset ? 'offset' : 'value'} getter ${
            this.getter
        }, setter: ${this.setter}`;
    }
}

export class ShapeMethod extends ShapeMember {
    constructor(storage: ShapeMemberStorage, private _func?: Value | number) {
        super(MemberType.METHOD, storage);
    }

    get methodOffset(): number | undefined {
        return this.isOffset && this._func !== undefined
            ? (this._func as number)
            : undefined;
    }

    get methodValue(): Value | undefined {
        return this.isValue && this._func !== undefined
            ? (this._func as Value)
            : undefined;
    }

    get method(): Value | number | undefined {
        return this._func;
    }

    get isEmpty(): boolean {
        return this._func == undefined;
    }

    toString(): string {
        return `ShapeMethod: ${this.isOffset ? 'offset' : 'value'} method ${
            this.method
        }`;
    }
}

export class Shape {
    public members?: Array<ShapeMember>;

    constructor(
        public readonly meta: ObjectDescription,
        private readonly _generic?: Shape,
    ) {}

    get genericShape(): Shape {
        return this._generic ? this._generic : this;
    }

    get hasGeneric(): boolean {
        return !!this._generic;
    }

    getMember(idx: number): ShapeMember | undefined {
        if (this.members) return this.members[idx];
        return undefined;
    }

    isStaticShape(): boolean {
        if (this.members) {
            for (let i = 0; i < this.members.length; i++) {
                if (!this.members[i]) return false;
            }
            return true;
        }
        return false;
    }

    dump(writer: DumpWriter) {
        writer.write(`shape: of meta ${this.meta.name} {`);
        writer.shift();
        if (this.members) {
            for (const m of this.members) {
                if (m) m.dump(writer);
                else writer.write('<NULL-MEMBER>');
            }
        }
        writer.unshift();
    }
}

////////////////////////////////////////////////
export const use_shape = true; // delete me when we removed
