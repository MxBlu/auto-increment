"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AutoIncrementID = exports.AutoIncrementIDSkipSymbol = exports.AutoIncrementSimple = exports.isNullOrUndefined = void 0;
const tslib_1 = require("tslib");
const mongoose = require("mongoose");
const logSettings_1 = require("./logSettings");
const DEFAULT_INCREMENT = 1;
/**
 * Because since node 4.0.0 the internal util.is* functions got deprecated
 * @param val Any value to test if null or undefined
 */
function isNullOrUndefined(val) {
    return val === null || val === undefined;
}
exports.isNullOrUndefined = isNullOrUndefined;
/**
 * The Plugin - Simple version
 * Increments an value each time it is saved
 * @param schema The Schema
 * @param options The Options
 */
function AutoIncrementSimple(schema, options) {
    // convert normal object into an array
    const fields = Array.isArray(options) ? options : [options];
    logSettings_1.logger.info('Initilaize AutoIncrement for an schema with %d fields to increment', fields.length);
    if (fields.length <= 0) {
        throw new Error('Options with at least one field are required!');
    }
    // check if all fields are valid
    for (const field of fields) {
        const schemaField = schema.path(field.field);
        // check if the field is even existing
        if (isNullOrUndefined(schemaField)) {
            throw new Error(`Field "${field.field}" does not exists on the Schema!`);
        }
        // check if the field is an number
        if (!(schemaField instanceof mongoose.Schema.Types.Number)) {
            throw new Error(`Field "${field.field}" is not an SchemaNumber!`);
        }
        if (isNullOrUndefined(field.incrementBy)) {
            logSettings_1.logger.info('Field "%s" does not have an incrementBy defined, defaulting to %d', field.field, DEFAULT_INCREMENT);
            field.incrementBy = DEFAULT_INCREMENT;
        }
    }
    schema.pre('save', function AutoIncrementPreSaveSimple() {
        if (!this.isNew) {
            logSettings_1.logger.info('Starting to increment "%s"', this.constructor.modelName);
            for (const field of fields) {
                logSettings_1.logger.info('Incrementing "%s" by %d', field.field, field.incrementBy);
                this[field.field] += field.incrementBy;
            }
        }
    });
}
exports.AutoIncrementSimple = AutoIncrementSimple;
/** The Schema used for the trackers */
const IDSchema = new mongoose.Schema({
    field: String,
    model: String,
    count: Number,
    reference_values: Object
}, { versionKey: false });
IDSchema.index({ field: 1, model: 1, reference_values: 1 }, { unique: true });
exports.AutoIncrementIDSkipSymbol = Symbol('AutoIncrementIDSkip');
/**
 * The Plugin - ID
 * Increments an counter in an tracking collection
 * @param schema The Schema
 * @param options The Options
 */
function AutoIncrementID(schema, options) {
    /** The Options with default options applied */
    const opt = Object.assign({ field: '_id', incrementBy: DEFAULT_INCREMENT, trackerCollection: 'identitycounters', trackerModelName: 'identitycounter', startAt: 0, reference_fields: [] }, options);
    // check if the field is an number
    if (!(schema.path(opt.field) instanceof mongoose.Schema.Types.Number)) {
        throw new Error(`Field "${opt.field}" is not an SchemaNumber!`);
    }
    // Check that reference fields exist in the model
    for (const field of opt.reference_fields) {
        if (!(schema.path(field) != null)) {
            throw new Error(`Reference field "${field}" does not exist!`);
        }
    }
    let model;
    // Return the values of the reference fields in a given doc
    const _getCounterReferenceField = (doc) => {
        const referenceValues = {};
        // Populate the reference object with reference values
        for (const field of opt.reference_fields) {
            referenceValues[field] = doc[field];
        }
        return referenceValues;
    };
    logSettings_1.logger.info('AutoIncrementID called with options %O', opt);
    schema.pre('save', function AutoIncrementPreSaveID() {
        var _a;
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            logSettings_1.logger.info('AutoIncrementID PreSave');
            const modelName = this.constructor.modelName;
            // Get reference values for doc
            const referenceValues = _getCounterReferenceField(this);
            if (!model) {
                logSettings_1.logger.info('Creating idtracker model named "%s"', opt.trackerModelName);
                // needs to be done, otherwise "undefiend" error if the plugin is used in an sub-document
                const db = (_a = this.db) !== null && _a !== void 0 ? _a : this.ownerDocument().db;
                model = db.model(opt.trackerModelName, IDSchema, opt.trackerCollection);
                // test if the counter document already exists
                const counter = yield model.findOne({ model: modelName, field: opt.field, reference_values: referenceValues }).lean().exec();
                if (!counter) {
                    yield model.create({
                        model: modelName,
                        field: opt.field,
                        count: opt.startAt - opt.incrementBy,
                        reference_values: referenceValues
                    });
                }
            }
            if (!this.isNew) {
                logSettings_1.logger.info('Document is not new, not incrementing');
                return;
            }
            if (typeof this[exports.AutoIncrementIDSkipSymbol] === 'boolean' && exports.AutoIncrementIDSkipSymbol) {
                logSettings_1.logger.info('Symbol "AutoIncrementIDSkipSymbol" is set to "true", skipping');
                return;
            }
            const { count } = yield model.findOneAndUpdate({
                field: opt.field,
                model: modelName,
                reference_values: referenceValues
            }, {
                $inc: { count: opt.incrementBy }
            }, {
                new: true,
                fields: { count: 1, _id: 0 },
                upsert: true,
                setDefaultsOnInsert: true
            }).lean().exec();
            logSettings_1.logger.info('Setting "%s" to "%d"', opt.field, count);
            this[opt.field] = count;
            return;
        });
    });
}
exports.AutoIncrementID = AutoIncrementID;
tslib_1.__exportStar(require("./types"), exports);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXV0b0luY3JlbWVudC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uL3NyYy9hdXRvSW5jcmVtZW50LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7QUFBQSxxQ0FBcUM7QUFDckMsK0NBQXVDO0FBR3ZDLE1BQU0saUJBQWlCLEdBQUcsQ0FBQyxDQUFDO0FBRTVCOzs7R0FHRztBQUNILFNBQWdCLGlCQUFpQixDQUFDLEdBQVk7SUFDNUMsT0FBTyxHQUFHLEtBQUssSUFBSSxJQUFJLEdBQUcsS0FBSyxTQUFTLENBQUM7QUFDM0MsQ0FBQztBQUZELDhDQUVDO0FBRUQ7Ozs7O0dBS0c7QUFDSCxTQUFnQixtQkFBbUIsQ0FDakMsTUFBNEIsRUFDNUIsT0FBa0U7SUFFbEUsc0NBQXNDO0lBQ3RDLE1BQU0sTUFBTSxHQUFpQyxLQUFLLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUM7SUFDMUYsb0JBQU0sQ0FBQyxJQUFJLENBQUMsb0VBQW9FLEVBQUUsTUFBTSxDQUFDLE1BQU0sQ0FBQyxDQUFDO0lBRWpHLElBQUksTUFBTSxDQUFDLE1BQU0sSUFBSSxDQUFDLEVBQUU7UUFDdEIsTUFBTSxJQUFJLEtBQUssQ0FBQywrQ0FBK0MsQ0FBQyxDQUFDO0tBQ2xFO0lBRUQsZ0NBQWdDO0lBQ2hDLEtBQUssTUFBTSxLQUFLLElBQUksTUFBTSxFQUFFO1FBQzFCLE1BQU0sV0FBVyxHQUFHLE1BQU0sQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQyxDQUFDO1FBQzdDLHNDQUFzQztRQUN0QyxJQUFJLGlCQUFpQixDQUFDLFdBQVcsQ0FBQyxFQUFFO1lBQ2xDLE1BQU0sSUFBSSxLQUFLLENBQUMsVUFBVSxLQUFLLENBQUMsS0FBSyxrQ0FBa0MsQ0FBQyxDQUFDO1NBQzFFO1FBQ0Qsa0NBQWtDO1FBQ2xDLElBQUksQ0FBQyxDQUFDLFdBQVcsWUFBWSxR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