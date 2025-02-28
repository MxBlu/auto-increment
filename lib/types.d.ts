/// <reference types="mongoose" />
import type { mongoose } from '@typegoose/typegoose';
export interface AutoIncrementOptionsSimple {
    /** Which Field to increment on save */
    field: string;
    /**
     * How much to increment the field by
     * @default 1
     */
    incrementBy?: number;
}
export declare type AutoIncrementSimplePluginOptions = AutoIncrementOptionsSimple | AutoIncrementOptionsSimple[];
export interface AutoIncrementIDOptions {
    /**
     * How much to increment the field by
     * @default 1
     */
    incrementBy?: number;
    /**
     * Set the field to increment
     * -> Only use this if it is not "_id"
     * @default _id
     */
    field?: string;
    /**
     * The Tracker Collection to use to keep track of an counter for the ID
     * @default identitycounters
     */
    trackerCollection?: string;
    /**
     * Set the tracker model name
     * @default identitycounter
     */
    trackerModelName?: string;
    /**
     * the count should start at
     * @default 0
     */
    startAt?: number;
    /**
     * Reference fields for unique counters in the same model
     * @default []
     */
    reference_fields?: string[];
}
export interface AutoIncrementIDTrackerSpec {
    /** The ModelName from the current model */
    modelName: string;
    /** The field in the schema */
    field: string;
    /** Current Tracker count */
    count: number;
    /** Reference values to compare against reference fields */
    reference_values: object;
}
export declare type AutoIncrementIDTrackerSpecDoc = mongoose.Document & AutoIncrementIDTrackerSpec;
