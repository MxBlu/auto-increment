import * as mongoose from 'mongoose';
import { logger } from './logSettings';
import type { AutoIncrementIDOptions, AutoIncrementIDTrackerSpecDoc, AutoIncrementOptionsSimple } from './types';

const DEFAULT_INCREMENT = 1;

/**
 * Because since node 4.0.0 the internal util.is* functions got deprecated
 * @param val Any value to test if null or undefined
 */
export function isNullOrUndefined(val: unknown): val is null | undefined {
  return val === null || val === undefined;
}

/**
 * The Plugin - Simple version
 * Increments an value each time it is saved
 * @param schema The Schema
 * @param options The Options
 */
export function AutoIncrementSimple(
  schema: mongoose.Schema<any>,
  options: AutoIncrementOptionsSimple[] | AutoIncrementOptionsSimple
): void {
  // convert normal object into an array
  const fields: AutoIncrementOptionsSimple[] = Array.isArray(options) ? options : [options];
  logger.info('Initilaize AutoIncrement for an schema with %d fields to increment', fields.length);

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
      logger.info('Field "%s" does not have an incrementBy defined, defaulting to %d', field.field, DEFAULT_INCREMENT);
      field.incrementBy = DEFAULT_INCREMENT;
    }
  }
  // to have an name to the function if debugging
  schema.pre('save', function AutoIncrementPreSaveSimple() {
    if (!this.isNew) {
      logger.info('Starting to increment "%s"', (this.constructor as mongoose.Model<any>).modelName);
      for (const field of fields) {
        logger.info('Incrementing "%s" by %d', field.field, field.incrementBy);
        this[field.field] += field.incrementBy;
      }
    }
  });
}

/** The Schema used for the trackers */
const IDSchema = new mongoose.Schema<AutoIncrementIDTrackerSpecDoc>({
  field: String,
  modelName: String,
  count: Number,
  reference_values: Object
}, { versionKey: false });
IDSchema.index({ field: 1, modelName: 1, reference_values: 1 }, { unique: true });

export const AutoIncrementIDSkipSymbol = Symbol('AutoIncrementIDSkip');

/**
 * The Plugin - ID
 * Increments an counter in an tracking collection
 * @param schema The Schema
 * @param options The Options
 */
export function AutoIncrementID(schema: mongoose.Schema<any>, options: AutoIncrementIDOptions): void {
  /** The Options with default options applied */
  const opt: Required<AutoIncrementIDOptions> = {
    field: '_id',
    incrementBy: DEFAULT_INCREMENT,
    trackerCollection: 'identitycounters',
    trackerModelName: 'identitycounter',
    startAt: 0,
    reference_fields: [],
    ...options
  };

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

  let model: mongoose.Model<AutoIncrementIDTrackerSpecDoc>;

  // Return the values of the reference fields in a given doc
  const _getCounterReferenceField = (doc: mongoose.Document): object => {
    const referenceValues: object = {};

    // Populate the reference object with reference values
    for (const field of opt.reference_fields) {
      referenceValues[field] = doc[field];
    }

    return referenceValues;
  };

  logger.info('AutoIncrementID called with options %O', opt);

  schema.pre('save', async function AutoIncrementPreSaveID(): Promise<void> {
    logger.info('AutoIncrementID PreSave');

    const modelName: string = (this.constructor as any).modelName;

    // Get reference values for doc
    const referenceValues = _getCounterReferenceField(this);

    if (!model) {
      logger.info('Creating idtracker model named "%s"', opt.trackerModelName);
      // needs to be done, otherwise "undefiend" error if the plugin is used in an sub-document
      const db: mongoose.Connection = this.db ?? (this as any).ownerDocument().db;
      model = db.model<AutoIncrementIDTrackerSpecDoc>(opt.trackerModelName, IDSchema, opt.trackerCollection);
      // test if the counter document already exists
      const counter = await model
        .findOne({
          modelName: modelName,
          field: opt.field,
          reference_values: referenceValues
        })
        .lean()
        .exec();
      if (!counter) {
        await model.create({
          modelName: modelName,
          field: opt.field,
          count: opt.startAt - opt.incrementBy,
          reference_values: referenceValues
        });
      }
    }

    if (!this.isNew) {
      logger.info('Document is not new, not incrementing');

      return;
    }

    if (typeof this[AutoIncrementIDSkipSymbol] === 'boolean' && AutoIncrementIDSkipSymbol) {
      logger.info('Symbol "AutoIncrementIDSkipSymbol" is set to "true", skipping');

      return;
    }

    const leandoc: { count: number } = (await model
      .findOneAndUpdate(
        {
          field: opt.field,
          modelName: modelName,
          reference_values: referenceValues
        },
        {
          $inc: { count: opt.incrementBy },
        },
        {
          new: true,
          fields: { count: 1, _id: 0 },
          upsert: true,
          setDefaultsOnInsert: true,
        }
      )
      .lean()
      .exec()) as any; // it seems like "FindAndModifyWriteOpResultObject" does not have a "count" property

    if (isNullOrUndefined(leandoc)) {
      throw new Error(`"findOneAndUpdate" incrementing count failed for "${modelName}" on field "${opt.field}"`);
    }

    logger.info('Setting "%s" to "%d"', opt.field, leandoc.count);
    this[opt.field] = leandoc.count;

    return;
  });
}

export * from './types';
